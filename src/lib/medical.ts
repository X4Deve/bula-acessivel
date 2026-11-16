// Regras clínicas e de fonte. Nada aqui gera conteúdo médico: apenas rótulos, validação de fonte e avisos.
export const BULARIO_URL = "https://consultas.anvisa.gov.br/#/bulario/";
export const BULARIO_HELP_URL =
  "https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/bulas-e-rotulos/como-acessar-o-bulario-eletronico";
export const MEDICAL_DISCLAIMER =
  "Informações de bula não substituem orientação médica; siga a prescrição recebida.";
export const CHECKIN_SAFETY_MESSAGE =
  "Se sintomas persistirem, piorarem ou surgirem reações, procure um profissional de saúde. Em caso de emergência procure atendimento imediato.";
export const NOT_AVAILABLE_MESSAGE = "Ainda não temos esta bula em texto acessível no aplicativo.";
export const TERMS_VERSION = "2026-11-v1";

const OFFICIAL_ANVISA =
  /^https:\/\/(consultas\.anvisa\.gov\.br|www\.gov\.br\/anvisa|anvisa\.gov\.br|www\.anvisa\.gov\.br)(\/|$|#|\?)/i;
/** Mesma regra aplicada no banco (is_official_anvisa_url). */
export function isOfficialAnvisaUrl(url: string): boolean {
  return OFFICIAL_ANVISA.test(url.trim());
}

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  anvisa_bulario: "Bulário Eletrônico da Anvisa",
  fabricante: "Site oficial do fabricante (não é a Anvisa)",
  fornecedor_autorizado: "Fornecedor de dados autorizado (não é a Anvisa)",
};

/** Seções padrão da bula do paciente. Só são exibidas se houver texto oficial cadastrado. */
export const LEAFLET_SECTIONS = [
  { key: "para_que_serve", title: "Para que serve" },
  { key: "como_funciona", title: "Como funciona" },
  { key: "quando_nao_usar", title: "Quando não devo usar" },
  { key: "antes_de_usar", title: "O que devo saber antes de usar" },
  { key: "como_usar", title: "Como usar" },
  { key: "reacoes_adversas", title: "Reações adversas" },
  { key: "composicao", title: "Composição" },
  { key: "informacoes_adicionais", title: "Informações adicionais" },
] as const;

export type LeafletSection = { key: string; title: string; content: string };

export function parseSections(json: unknown): LeafletSection[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (s): s is LeafletSection =>
        !!s &&
        typeof s === "object" &&
        typeof (s as LeafletSection).title === "string" &&
        typeof (s as LeafletSection).content === "string" &&
        (s as LeafletSection).content.trim() !== "",
    )
    .map((s) => ({ key: String(s.key ?? s.title), title: s.title, content: s.content }));
}

export function isCurationStale(
  checkedAt: string | null | undefined,
  validityDays: number,
  now = new Date(),
): boolean {
  if (!checkedAt) return true;
  const ms = now.getTime() - new Date(checkedAt).getTime();
  return ms > validityDays * 86_400_000;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export const USAGE_LABEL: Record<string, string> = {
  none: "Somente consultado",
  taking: "Em uso",
  stopped: "Uso encerrado",
};
