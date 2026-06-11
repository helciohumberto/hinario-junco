# Hinário Junco

Um leitor web simples e bonito para os 597 hinos do Hinário Junco. Funciona direto no navegador, sem precisar instalar nada — basta abrir e cantar.

## O que ele faz

- Busca por número, título ou qualquer palavra do hino
- Navega entre os hinos com botões de Anterior e Próximo
- Ajuste de tamanho de fonte para quem precisa de letras maiores
- Tema claro e escuro
- Funciona bem no celular

## Como rodar localmente

Você vai precisar do arquivo PDF do Hinário Junco. Com ele em mãos:

**1. Extraia os hinos do PDF**

```bash
pip install pdfplumber
python extract_hinos.py "Hinário Junco.pdf"
```

Isso gera o arquivo `hinos.json` com todos os 597 hinos.

**2. Suba um servidor local**

```bash
python -m http.server 8080
```

Abra `http://localhost:8080` no navegador. Pronto.

> O servidor local é necessário porque o navegador bloqueia leitura de arquivos JSON diretamente do disco por questões de segurança.

## Opções do script de extração

```bash
# Modo debug — salva o texto bruto extraído do PDF para inspeção
python extract_hinos.py "Hinário Junco.pdf" --debug

# Se o seu PDF tiver um número diferente de hinos
python extract_hinos.py "Hinário Junco.pdf" --total 600

# Salvar em outro arquivo
python extract_hinos.py "Hinário Junco.pdf" -o outro-nome.json
```

## Deploy no GitHub Pages

O projeto já vem com o workflow configurado. Basta ativar o GitHub Pages nas configurações do repositório (Settings → Pages → Source: GitHub Actions) e fazer um push para a branch `main`. O deploy acontece automaticamente.

Lembre de incluir o `hinos.json` gerado no repositório — sem ele o site não carrega os hinos.

## Estrutura do projeto

```
├── index.html          — página principal
├── script.js           — lógica da aplicação
├── style.css           — estilos
├── hinos.json          — hinos extraídos (gerado pelo script)
├── extract_hinos.py    — script de extração do PDF
├── requirements.txt    — dependência Python (pdfplumber)
└── pngegg.png          — logotipo
```

## Tecnologias

HTML, CSS e JavaScript puros — sem frameworks, sem dependências de front-end. O script de extração usa [pdfplumber](https://github.com/jsvine/pdfplumber).
