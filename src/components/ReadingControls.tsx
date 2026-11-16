import { Button } from "@/components/ui/button";
import { usePrefs } from "@/lib/prefs";

export function ReadingControls() {
  const { prefs, setPrefs, bigger, smaller } = usePrefs();
  const sizeLabel = { base: "100%", lg: "112%", xl: "125%", xxl: "150%" }[prefs.font];
  return (
    <div
      role="group"
      aria-label="Ajustes de leitura"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface p-3"
    >
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 min-w-11"
        onClick={smaller}
        aria-label="Diminuir fonte"
        disabled={prefs.font === "base"}
      >
        A−
      </Button>
      <span className="text-sm" aria-live="polite">
        Fonte {sizeLabel}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 min-w-11"
        onClick={bigger}
        aria-label="Aumentar fonte"
        disabled={prefs.font === "xxl"}
      >
        A+
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        aria-pressed={prefs.contrast === "high"}
        onClick={() => setPrefs({ contrast: prefs.contrast === "high" ? "normal" : "high" })}
      >
        Alto contraste {prefs.contrast === "high" ? "(ligado)" : "(desligado)"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        aria-pressed={prefs.spacing === "wide"}
        onClick={() => setPrefs({ spacing: prefs.spacing === "wide" ? "normal" : "wide" })}
      >
        Espaçamento amplo {prefs.spacing === "wide" ? "(ligado)" : "(desligado)"}
      </Button>
    </div>
  );
}
