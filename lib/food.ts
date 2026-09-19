import type { Med, Severity } from "@/lib/types";
import { genericFor } from "@/lib/plainNames";

export interface FoodResult {
  id: string;
  medicine: Med;
  food: string;
  severity: Severity;
  explanation: string;
  guidance: string;
  source?: string;
}
export const SEVERITY_HELP = {
  en: {
    major:
      "Potential for serious harm. Review this combination with your pharmacist.",
    moderate:
      "May change how the medicine works. Ask about food or timing changes.",
    minor:
      "A food or comfort note that is usually less serious. Follow your label.",
    unknown:
      "Not enough information in our guide. This does not mean it is safe.",
  },
  es: {
    major:
      "Posibilidad de daño grave. Consulte esta combinación con su farmacéutico.",
    moderate:
      "Puede cambiar el efecto del medicamento. Pregunte sobre alimentos y horarios.",
    minor:
      "Una nota de alimentación o comodidad, generalmente menos grave. Siga su etiqueta.",
    unknown:
      "No hay suficiente información en nuestra guía. No significa que sea seguro.",
  },
};
type Entry = {
  ingredient: string;
  food: [string, string];
  severity: Severity;
  explanation: [string, string];
  guidance: [string, string];
  page: string;
};
// A small, sourced educational guide, not a complete interaction database.
// Severity is an editorial reading aid, not a MedlinePlus clinical classification.
const GUIDE: Entry[] = [
  {
    ingredient: "metformin",
    food: ["Alcohol", "Alcohol"],
    severity: "major",
    explanation: [
      "Alcohol can increase the risk of a rare, serious buildup of lactic acid and may lower blood sugar with metformin.",
      "El alcohol puede aumentar el riesgo de una acumulación rara y grave de ácido láctico y reducir el azúcar en sangre con metformina.",
    ],
    guidance: [
      "Tell your pharmacist about alcohol use, including binge drinking, and ask what is safe for you.",
      "Informe a su farmacéutico sobre el consumo de alcohol, incluso en grandes cantidades, y pregunte qué es seguro para usted.",
    ],
    page: "a696005",
  },
  {
    ingredient: "lisinopril",
    food: ["Salt substitutes with potassium", "Sustitutos de sal con potasio"],
    severity: "moderate",
    explanation: [
      "The medicine guide flags potassium-containing salt substitutes for review with lisinopril.",
      "La guía del medicamento indica consultar sobre los sustitutos de sal con potasio al tomar lisinopril.",
    ],
    guidance: [
      "Ask your pharmacist before using potassium-containing salt substitutes. Follow any prescribed low-salt diet.",
      "Consulte antes de usar sustitutos de sal con potasio. Siga cualquier dieta baja en sal que le hayan indicado.",
    ],
    page: "a692051",
  },
  {
    ingredient: "warfarin",
    food: ["Leafy greens · vitamin K", "Verduras de hoja · vitamina K"],
    severity: "moderate",
    explanation: [
      "Changes in vitamin K intake can change how warfarin works.",
      "Los cambios en el consumo de vitamina K pueden cambiar el efecto de la warfarina.",
    ],
    guidance: [
      "Keep vitamin K intake consistent. Discuss diet changes with your pharmacist; do not cut out vegetables on your own.",
      "Mantenga constante el consumo de vitamina K. Consulte antes de cambiar su dieta; no elimine verduras por su cuenta.",
    ],
    page: "a682277",
  },
  {
    ingredient: "simvastatin",
    food: ["Grapefruit", "Toronja"],
    severity: "major",
    explanation: [
      "Grapefruit can increase exposure to simvastatin and the risk of serious side effects.",
      "La toronja puede aumentar la exposición a la simvastatina y el riesgo de efectos graves.",
    ],
    guidance: [
      "Ask your pharmacist about grapefruit and grapefruit juice while taking simvastatin.",
      "Pregunte a su farmacéutico sobre la toronja y su jugo mientras toma simvastatina.",
    ],
    page: "a692030",
  },
  {
    ingredient: "ciprofloxacin",
    food: ["Dairy · calcium-fortified juice", "Lácteos · jugo con calcio"],
    severity: "moderate",
    explanation: [
      "Dairy or calcium-fortified juice taken alone can affect absorption of ciprofloxacin.",
      "Los lácteos o jugos con calcio tomados solos pueden afectar la absorción de ciprofloxacina.",
    ],
    guidance: [
      "The guide distinguishes dairy alone from dairy in a full meal. Ask your pharmacist how this applies to your meals.",
      "La guía distingue los lácteos solos de los incluidos en una comida completa. Pregunte cómo se aplica a sus comidas.",
    ],
    page: "a688016",
  },
  {
    ingredient: "levothyroxine",
    food: ["Soy · walnuts · dietary fiber", "Soya · nueces · fibra"],
    severity: "moderate",
    explanation: [
      "These foods can affect how your body absorbs levothyroxine.",
      "Estos alimentos pueden afectar la absorción de levotiroxina.",
    ],
    guidance: [
      "Tell your pharmacist about these foods and follow the timing on your prescription label.",
      "Informe a su farmacéutico sobre estos alimentos y siga el horario de su etiqueta.",
    ],
    page: "a682461",
  },
  {
    ingredient: "ibuprofen",
    food: ["Food or milk", "Comida o leche"],
    severity: "minor",
    explanation: [
      "Food or milk may help prevent stomach upset with ibuprofen. This is a comfort note, not an assurance of safety.",
      "La comida o leche puede ayudar a prevenir el malestar estomacal con ibuprofeno. Esta nota no garantiza seguridad.",
    ],
    guidance: [
      "Follow your bottle directions. Ask your pharmacist about stomach symptoms or bleeding concerns.",
      "Siga las indicaciones del frasco. Pregunte sobre molestias estomacales o sangrado.",
    ],
    page: "a682159",
  },
];
export function checkFoods(
  meds: Med[],
  lang: "en" | "es" = "en",
): FoodResult[] {
  const i = lang === "es" ? 1 : 0;
  return meds.flatMap((medicine) => {
    const key = (
      genericFor(medicine.name) ||
      medicine.ingredientName ||
      medicine.name
    )
      .trim()
      .toLowerCase();
    const entries = GUIDE.filter((e) => e.ingredient === key);
    if (!entries.length)
      return [
        {
          id: `${medicine.rxcui}-unknown`,
          medicine,
          food: i ? "Alimentos sin verificar" : "Foods not yet reviewed",
          severity: "unknown" as Severity,
          explanation: i
            ? "Nuestra guía no tiene una entrada verificada para este medicamento."
            : "Our guide does not have a verified food entry for this medicine.",
          guidance: i
            ? "Consulte la etiqueta y pregunte a un farmacéutico sobre comidas y bebidas."
            : "Check your label and ask a pharmacist about foods and drinks.",
        },
      ];
    return entries.map((e) => ({
      id: `${medicine.rxcui}-${e.page}`,
      medicine,
      food: e.food[i],
      severity: e.severity,
      explanation: e.explanation[i],
      guidance: e.guidance[i],
      source:
        e.ingredient === "simvastatin"
          ? "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix"
          : `https://medlineplus.gov/druginfo/meds/${e.page}.html`,
    }));
  });
}
