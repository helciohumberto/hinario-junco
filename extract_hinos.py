#!/usr/bin/env python3
"""
extract_hinos.py — Extrai os 597 hinos do Hinário Junco e gera hinos.json

Uso:
    python extract_hinos.py "Hinário Junco.pdf"
    python extract_hinos.py "Hinário Junco.pdf" --debug   # salva texto bruto
    python extract_hinos.py "Hinário Junco.pdf" --total 597
"""

import sys, re, json, os, unicodedata, argparse

# ── Dependências ──────────────────────────────────────────────────────────────
try:
    import pdfplumber
except ImportError:
    print("Instalando pdfplumber...")
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pdfplumber'])
    import pdfplumber


# ── Utilitários ───────────────────────────────────────────────────────────────
def normalize(text):
    """Minúsculas sem acentos, para o campo de busca."""
    nfkd = unicodedata.normalize('NFKD', text.lower())
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def pad(n):
    return str(n).zfill(3)


# ── Extração de texto do PDF ──────────────────────────────────────────────────
def extract_raw_text(pdf_path):
    """
    Extrai texto usando layout=True para capturar os espaçamentos verticais
    reais do PDF.

    Regra observada neste hinário:
      • 1-2 linhas em branco entre linhas  → espaçamento normal, mesma estrofe
      • 3+  linhas em branco entre linhas  → separador de estrofe → insere \n\n
    Números de página (linha = só dígitos) são descartados.
    """
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            print(f'\r  Página {i+1}/{total}...', end='', flush=True)
            raw = page.extract_text(layout=True) or ''

            result = []
            blank_run = 0

            for line in raw.split('\n'):
                # Normaliza espaços múltiplos deixados pelo layout
                s = re.sub(r'  +', ' ', line.strip())

                if s == '':
                    blank_run += 1
                else:
                    # Espaço grande antes desta linha → nova estrofe
                    if blank_run >= 3 and result:
                        result.append('')
                    blank_run = 0
                    result.append(s)

            pages.append('\n'.join(result))

    print()
    return '\n'.join(pages)


# ── Localização de cada hino ──────────────────────────────────────────────────
def find_all_starts(text, total):
    """
    Para cada número de 1 a `total`:
    1. Tenta encontrar  \\nN.\\n  (número com ponto — padrão da maioria)
    2. Se não achar,    \\nN\\n   (número sem ponto — usado em ~25 hinos)
    Retorna dict {number: position_in_text}.
    """
    starts = {}

    for n in range(1, total + 1):
        # Padrão preferido: N. isolado na linha
        for pat in (f'\n{n}.\n', f'\n{n}\n'):
            idx = text.find(pat)
            if idx != -1:
                # +1 pula o \n inicial, fica apontando para 'N' ou 'N.'
                starts[n] = idx + 1
                break

    return starts


# ── Limpeza do conteúdo ───────────────────────────────────────────────────────
def clean(raw):
    """Remove resíduos e normaliza: no máximo uma linha em branco entre estrofes."""
    lines = raw.split('\n')
    out = []
    for line in lines:
        s = line.strip()
        # Descarta resíduos numéricos que porventura escaparam
        if re.match(r'^\d{1,4}$', s):
            continue
        # Rótulo de coro/refrão sempre inicia estrofe nova (a quebra se perde
        # quando coincide com a quebra de página do PDF)
        if out and out[-1] != '' and re.match(r'^(coro|refr[aã]o)\b', normalize(s)):
            out.append('')
        out.append(s)
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


# ── Extração de título ────────────────────────────────────────────────────────
def extract_title(content):
    """
    Usa a primeira linha não-vazia do conteúdo como título.
    Trunca em 80 chars se for muito longa.
    """
    for line in content.split('\n'):
        t = line.strip()
        # Pula rótulos de refrão e linhas muito curtas
        if t and not re.match(r'^(coro|refr[aã]o)\s*:?\s*$', t, re.I):
            # Remove diretivas de execução entre parênteses se o título
            # ficar muito longo
            clean_t = re.sub(r'\s*\(.*?\)', '', t).strip() or t
            return clean_t[:80]
    return 'Sem título'


# ── Construção da entrada JSON ────────────────────────────────────────────────
def build_entry(num, content):
    title = extract_title(content)
    return {
        "number": num,
        "id":     pad(num),
        "title":  title,
        "content": content,
        "search": normalize(title + ' ' + content),
    }


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description='Extrai hinos do PDF do Hinário Junco e gera hinos.json'
    )
    parser.add_argument('pdf',   help='Caminho para o arquivo PDF')
    parser.add_argument('-o', '--output', default='hinos.json',
                        help='Arquivo de saída (padrão: hinos.json)')
    parser.add_argument('--total', type=int, default=597,
                        help='Total de hinos esperados (padrão: 597)')
    parser.add_argument('--debug', action='store_true',
                        help='Salva texto bruto em debug_text.txt e encerra')
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f'Erro: "{args.pdf}" não encontrado.')
        sys.exit(1)

    print(f'Lendo PDF: {args.pdf}')
    raw = extract_raw_text(args.pdf)

    if args.debug:
        with open('debug_text.txt', 'w', encoding='utf-8') as f:
            f.write(raw)
        print('Texto bruto salvo em: debug_text.txt')
        return

    # Garante \n no início para que o padrão \nN.\n funcione no hino 1
    raw = '\n' + raw

    print(f'Localizando {args.total} hinos...')
    starts = find_all_starts(raw, args.total)

    found_count = len(starts)
    missing = [n for n in range(1, args.total + 1) if n not in starts]
    print(f'  Encontrados: {found_count}/{args.total}')
    if missing:
        print(f'  Não encontrados: {missing}')

    if found_count == 0:
        print('Nenhum hino encontrado. Use --debug para inspecionar o texto.')
        sys.exit(1)

    # Ordena os hinos por posição no texto
    ordered = sorted(starts.items(), key=lambda x: x[1])

    print('Extraindo conteúdo...')
    entries = []
    for i, (num, pos) in enumerate(ordered):
        # Conteúdo vai do fim da linha do número até o início do próximo hino
        start_of_content = raw.find('\n', pos) + 1
        end_of_content = ordered[i + 1][1] if i + 1 < len(ordered) else len(raw)
        raw_content = raw[start_of_content:end_of_content]
        content = clean(raw_content)
        entries.append(build_entry(num, content))
        print(f'\r  {i+1}/{found_count} — Hino {pad(num)}', end='', flush=True)

    print()

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    size_kb = os.path.getsize(args.output) / 1024
    print(f'\nPronto! {len(entries)} hinos em "{args.output}" ({size_kb:.0f} KB)')
    print('\nPara testar localmente:')
    print('  python -m http.server 8080')
    print('  Acesse: http://localhost:8080')


if __name__ == '__main__':
    main()
