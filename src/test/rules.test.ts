import { describe, expect, it } from "vitest";
import { isOfficialAnvisaUrl, isCurationStale, parseSections } from "@/lib/medical";
import { nextOccurrences } from "@/lib/reminders";

describe("links rotulados Anvisa", () => {
  it("aceita host oficial do Bulário", () =>
    expect(isOfficialAnvisaUrl("https://consultas.anvisa.gov.br/#/bulario/")).toBe(true));
  it("aceita gov.br/anvisa", () =>
    expect(isOfficialAnvisaUrl("https://www.gov.br/anvisa/pt-br/x")).toBe(true));
  it("rejeita domínio parecido", () =>
    expect(isOfficialAnvisaUrl("https://consultas.anvisa.gov.br.evil.com/")).toBe(false));
  it("rejeita http sem TLS", () =>
    expect(isOfficialAnvisaUrl("http://consultas.anvisa.gov.br/")).toBe(false));
  it("rejeita outra área do gov.br", () =>
    expect(isOfficialAnvisaUrl("https://www.gov.br/saude")).toBe(false));
});

describe("curadoria vencida", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  it("181 dias com validade 180 está vencida", () =>
    expect(isCurationStale("2026-05-18T12:00:00Z", 180, now)).toBe(true));
  it("10 dias não está vencida", () =>
    expect(isCurationStale("2026-11-05T12:00:00Z", 180, now)).toBe(false));
});

describe("seções sem texto não são exibidas", () => {
  it("remove seção vazia", () =>
    expect(
      parseSections([
        { key: "a", title: "A", content: " " },
        { key: "b", title: "B", content: "x" },
      ]).map((s) => s.key),
    ).toEqual(["b"]));
});

describe("lembretes usam somente horários do usuário em America/Sao_Paulo", () => {
  // 15/11/2026 é domingo; 12:00Z = 09:00 em São Paulo
  const now = new Date("2026-11-15T12:00:00Z");
  it("pula horário já passado hoje e respeita dias escolhidos", () => {
    const occ = nextOccurrences(
      {
        local_times: ["08:00", "20:00"],
        weekdays: [0, 1],
        start_date: "2026-11-01",
        end_date: null,
        active: true,
      },
      now,
      2,
    );
    expect(occ).toEqual([
      { date: "2026-11-15", time: "20:00", weekday: 0 },
      { date: "2026-11-16", time: "08:00", weekday: 1 },
      { date: "2026-11-16", time: "20:00", weekday: 1 },
    ]);
  });
  it("lembrete pausado não gera ocorrências", () => {
    expect(
      nextOccurrences(
        {
          local_times: ["20:00"],
          weekdays: [0],
          start_date: "2026-11-01",
          end_date: null,
          active: false,
        },
        now,
      ),
    ).toEqual([]);
  });
  it("respeita data de término", () => {
    expect(
      nextOccurrences(
        {
          local_times: ["20:00"],
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          start_date: "2026-11-01",
          end_date: "2026-11-15",
          active: true,
        },
        now,
      ),
    ).toHaveLength(1);
  });
});
