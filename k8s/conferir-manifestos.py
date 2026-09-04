# -*- coding: utf-8 -*-
"""Confere os manifestos do Kubernetes antes de alguém aplicar.

Nenhuma ferramenta de esquema pega o que este arquivo pega: o YAML é válido e
os campos existem. O que falta é conferir que uma coisa REFERIDA existe de
verdade. Um HorizontalPodAutoscaler que escala um Deployment inexistente, um
Service cujo seletor não casa com pod nenhum, uma variável que pede uma chave
que o Secret não declara: tudo isso passa no `kubectl apply` sem uma linha de
erro, e o sintoma aparece depois, como "não tem nada respondendo".

Roda sem cluster e sem kubectl, que é o ponto: vale no CI de graça.

Uso: python k8s/conferir-manifestos.py
"""
import glob
import io
import os
import sys

try:
    import yaml
except ImportError:
    print('pyyaml não está instalado: pip install pyyaml')
    sys.exit(2)

PASTA = os.path.dirname(os.path.abspath(__file__))

documentos = []
for caminho in sorted(glob.glob(os.path.join(PASTA, '*.yaml'))):
    with io.open(caminho, encoding='utf-8') as arquivo:
        for doc in yaml.safe_load_all(arquivo):
            if doc:
                documentos.append((os.path.basename(caminho), doc))

erros = []


def de(tipo):
    return [(a, d) for a, d in documentos if d.get('kind') == tipo]


def containers(doc):
    """Os contêineres de um Deployment ou de um Job, que têm formatos diferentes."""
    if doc.get('kind') == 'Deployment':
        return doc['spec']['template']['spec']['containers']
    if doc.get('kind') == 'Job':
        return doc['spec']['template']['spec']['containers']
    return []


nomes_de_deployment = {d['metadata']['name'] for _, d in de('Deployment')}
rotulos_de_deployment = {
    d['spec']['selector']['matchLabels'].get('app.kubernetes.io/name'): d['metadata']['name']
    for _, d in de('Deployment')
}

# 1. Todo alvo de escala e todo seletor precisam achar um Deployment.
for arq, d in de('HorizontalPodAutoscaler'):
    alvo = d['spec']['scaleTargetRef']['name']
    if alvo not in nomes_de_deployment:
        erros.append('%s: o HPA %s escala o Deployment %s, que não existe'
                     % (arq, d['metadata']['name'], alvo))

for arq, d in de('PodDisruptionBudget'):
    rotulo = d['spec']['selector']['matchLabels'].get('app.kubernetes.io/name')
    if rotulo not in rotulos_de_deployment:
        erros.append('%s: o PDB %s seleciona %s, que nenhum Deployment tem'
                     % (arq, d['metadata']['name'], rotulo))

# 2. Todo Service precisa achar pod, senão ele responde recusa de conexão.
for arq, d in de('Service'):
    rotulo = d['spec']['selector'].get('app.kubernetes.io/name')
    if rotulo not in rotulos_de_deployment:
        erros.append('%s: o Service %s aponta para %s, que nenhum Deployment tem'
                     % (arq, d['metadata']['name'], rotulo))

# 3. O mínimo de escala não pode ser menor que o mínimo de disponibilidade,
#    senão o autoscaler encolhe até um número que o orçamento de interrupção
#    proíbe, e a publicação trava esperando por uma folga que não vem.
minimos_do_hpa = {d['spec']['scaleTargetRef']['name']: d['spec'].get('minReplicas', 1)
                  for _, d in de('HorizontalPodAutoscaler')}
for arq, d in de('PodDisruptionBudget'):
    rotulo = d['spec']['selector']['matchLabels'].get('app.kubernetes.io/name')
    alvo = rotulos_de_deployment.get(rotulo)
    minimo_pdb = d['spec'].get('minAvailable')
    if alvo and isinstance(minimo_pdb, int) and minimos_do_hpa.get(alvo, 1) <= minimo_pdb:
        erros.append('%s: o PDB exige %d pod disponível e o HPA pode encolher para %d'
                     % (arq, minimo_pdb, minimos_do_hpa.get(alvo, 1)))

# 4. Toda chave de Secret e todo ConfigMap referidos precisam estar declarados.
chaves = {d['metadata']['name']: set(d.get('stringData', {}) or {}) for _, d in de('Secret')}
configmaps = {d['metadata']['name'] for _, d in de('ConfigMap')}

for arq, d in de('Deployment') + de('Job'):
    for c in containers(d):
        for var in c.get('env', []):
            ref = (var.get('valueFrom') or {}).get('secretKeyRef')
            if not ref:
                continue
            if ref['name'] not in chaves:
                erros.append('%s: %s pede o Secret %s, que não está declarado'
                             % (arq, var['name'], ref['name']))
            elif ref['key'] not in chaves[ref['name']]:
                erros.append('%s: %s pede a chave %s do Secret %s, que tem %s'
                             % (arq, var['name'], ref['key'], ref['name'],
                                sorted(chaves[ref['name']])))
        for origem in c.get('envFrom', []):
            nome = (origem.get('configMapRef') or {}).get('name')
            if nome and nome not in configmaps:
                erros.append('%s: envFrom pede o ConfigMap %s, que não existe' % (arq, nome))

# 5. Todo volume montado precisa estar declarado. Montar volume inexistente
#    deixa o pod preso em ContainerCreating, sem erro no apply.
for arq, d in de('Deployment') + de('Job'):
    declarados = {v['name'] for v in d['spec']['template']['spec'].get('volumes', [])}
    for c in containers(d):
        for montagem in c.get('volumeMounts', []):
            if montagem['name'] not in declarados:
                erros.append('%s: o contêiner monta o volume %s, que não foi declarado'
                             % (arq, montagem['name']))

# 6. O que a plataforma exige do próprio contêiner.
for arq, d in de('Deployment'):
    for c in containers(d):
        nome = d['metadata']['name']
        if 'livenessProbe' not in c or 'readinessProbe' not in c:
            erros.append('%s: %s sem liveness ou readiness' % (arq, nome))
        if not (c.get('resources', {}).get('limits', {}) or {}).get('memory'):
            erros.append('%s: %s sem teto de memória, e um vazamento derruba o nó' % (arq, nome))
        if c.get('securityContext', {}).get('readOnlyRootFilesystem') is not True:
            erros.append('%s: %s com raiz gravável' % (arq, nome))

for arq, d in de('Deployment') + de('Job'):
    for c in containers(d):
        if ':latest' in c.get('image', '') or ':' not in c.get('image', ''):
            erros.append('%s: %s usa imagem sem etiqueta fixa, e não dá para voltar atrás'
                         % (arq, d['metadata']['name']))

# 7. Tudo no mesmo espaço, senão a regra de rede não vale para quem ficou fora.
espacos = {d['metadata'].get('namespace') for _, d in documentos
           if d.get('kind') != 'Namespace'}
if espacos - {'permaneia'}:
    erros.append('há objeto fora do namespace permaneia: %s' % sorted(espacos - {'permaneia'}))

# 8. A topologia precisa estar inteira: sem o Job, a aplicação sobe contra um
#    banco sem esquema e responde 500 em toda chamada.
ESPERADOS_DEPLOYMENT = {'permaneia'}
ESPERADOS_JOB = {'permaneia-esquema'}
faltando = (ESPERADOS_DEPLOYMENT - nomes_de_deployment) | (
    ESPERADOS_JOB - {d['metadata']['name'] for _, d in de('Job')})
if faltando:
    erros.append('falta manifesto para: %s' % ', '.join(sorted(faltando)))

if erros:
    print('manifestos com problema:')
    print('')
    for e in erros:
        print(' -', e)
    sys.exit(1)

print('manifestos conferidos: %d documentos, %d Deployments, %d Jobs, nada solto'
      % (len(documentos), len(nomes_de_deployment), len(de('Job'))))
