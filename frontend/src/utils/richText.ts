/**
 * Sanitização do HTML das mensagens do roteiro.
 *
 * O conteúdo é escrito num editor rico, e quem escreve costuma fixar a cor do
 * texto — quase sempre um preto ou um branco. Essa cor sobrevive no banco e
 * ignora o tema: mensagens gravadas com `color: rgb(17,17,17)` ficam ilegíveis
 * no modo escuro, e as gravadas em branco somem no modo claro. Foi o que
 * aconteceu com as mensagens de Outras Situações.
 *
 * A correção não é forçar branco — isso só inverteria o problema. É remover a
 * cor quando ela é praticamente preto ou branco, deixando o texto herdar a cor
 * do tema. Cores com intenção (laranja de destaque, vermelho de alerta)
 * continuam intactas.
 */

const CANAIS_ACROMATICOS = 24;
const LIMITE_ESCURO = 0.25;
const LIMITE_CLARO = 0.8;

const corParaRgb = (valor: string): [number, number, number] | null => {
  const texto = valor.replace(/\s+/g, "").toLowerCase();

  if (texto === "white") return [255, 255, 255];
  if (texto === "black") return [0, 0, 0];

  const hex = texto.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const bruto =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return [
      parseInt(bruto.slice(0, 2), 16),
      parseInt(bruto.slice(2, 4), 16),
      parseInt(bruto.slice(4, 6), 16),
    ];
  }

  const rgb = texto.match(/^rgba?\((\d+),(\d+),(\d+)/);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }

  return null;
};

/**
 * A cor é um cinza quase puro, muito escuro ou muito claro?
 *
 * Só nesse caso ela disputa com o tema. `rgb(17,17,17)` e `rgb(248,250,252)`
 * saem; laranja e vermelho ficam.
 */
export const isThemeDependentColor = (valor = "") => {
  const rgb = corParaRgb(valor);
  if (!rgb) {
    return false;
  }

  const [r, g, b] = rgb;
  const acromatico = Math.max(r, g, b) - Math.min(r, g, b) <= CANAIS_ACROMATICOS;
  if (!acromatico) {
    return false;
  }

  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia <= LIMITE_ESCURO || luminancia >= LIMITE_CLARO;
};

/** Tira do documento as cores que brigam com o tema. */
const limparCoresDoTema = (doc: Document) => {
  doc.body.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    if (isThemeDependentColor(element.style.color)) {
      element.style.removeProperty("color");
    }

    if (isThemeDependentColor(element.style.backgroundColor)) {
      element.style.removeProperty("background-color");
    }

    if (!element.getAttribute("style")?.trim()) {
      element.removeAttribute("style");
    }
  });
};

export const sanitizeThemeDependentStyles = (html = "") => {
  if (!html || typeof window === "undefined" || !/<[a-z][\s\S]*>/i.test(html)) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  limparCoresDoTema(doc);

  return doc.body.innerHTML;
};

/** Classe que o `.roteiro-mensagem` desenha como vega vermelha (index.css). */
export const CLASSE_TABULACAO = "roteiro-tabulacao";

const ACENTOS = /[\u0300-\u036f]/g;

/**
 * O bloco abre com "Tabulacao:"?
 *
 * Pura de proposito, por dois motivos. Da para testar sem DOM. E a deteccao e
 * por TEXTO, nao por marcacao: das 245 mensagens gravadas, 114 escrevem a
 * tabulacao a mao dentro do corpo -- nao existe coluna para ela em
 * TB_MENSAGEM. Gravar uma classe no banco tambem nao resolveria, porque o
 * Quill reescreve a marcacao a cada edicao e a classe se perderia na primeira
 * vez que alguem abrisse a mensagem para editar. O texto sobrevive.
 */
export const isTabulacaoText = (texto = "") =>
  /^tabulacao(?:\s+[a-z]+){0,2}\s*:/i.test(
    texto.normalize("NFD").replace(ACENTOS, "").trim(),
  );

/** Marca o paragrafo da tabulacao para o CSS desenhar a caixa. */
const marcarTabulacao = (doc: Document) => {
  doc.body
    .querySelectorAll<HTMLElement>("p, div, h1, h2, h3, h4")
    .forEach((element) => {
      // So o bloco folha: sem isto, um <div> que embrulhasse a mensagem
      // inteira tambem casaria, e sairia vega dentro de vega.
      if (element.querySelector("p, div, h1, h2, h3, h4")) {
        return;
      }

      if (isTabulacaoText(element.textContent || "")) {
        element.classList.add(CLASSE_TABULACAO);
      }
    });
};

const linkificarTexto = (texto: string) =>
  texto
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(
      /(^|[^/])(www\.[^\s<]+)/g,
      '$1<a href="http://$2" target="_blank" rel="noopener noreferrer">$2</a>',
    );

/** HTML pronto para `dangerouslySetInnerHTML`: links, cores e tabulacao. */
export const renderRichText = (texto = "") => {
  if (!texto) return "";

  if (!/<[a-z][\s\S]*>/i.test(texto)) {
    return linkificarTexto(texto);
  }

  if (typeof window === "undefined") {
    return texto;
  }

  const doc = new DOMParser().parseFromString(texto, "text/html");
  limparCoresDoTema(doc);
  marcarTabulacao(doc);

  return doc.body.innerHTML;
};
