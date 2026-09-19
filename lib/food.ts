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
  /** MedlinePlus drug page id, e.g. a600045 → https://medlineplus.gov/druginfo/meds/a600045.html */
  page: string;
  /** Optional override when the best consumer source is not the MedlinePlus page itself. */
  source?: string;
};

const FDA_GRAPEFRUIT =
  "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix";
const medlinePage = (page: string) =>
  `https://medlineplus.gov/druginfo/meds/${page}.html`;

// ---------------------------------------------------------------------------
// Small builders for the wording patterns MedlinePlus repeats across pages.
// Every entry below was checked against the live MedlinePlus page (2026-09-19);
// the `page` id is the one that was fetched.
// ---------------------------------------------------------------------------
const ALCOHOL_GUIDANCE: [string, string] = [
  "Ask your pharmacist what amount of alcohol, if any, is safe for you.",
  "Pregunte a su farmacéutico qué cantidad de alcohol, si alguna, es segura para usted.",
];

/** MedlinePlus: "Unless your doctor tells you otherwise, continue your normal diet." and nothing else. */
function usualDiet(ingredient: string, page: string): Entry {
  return {
    ingredient,
    food: ["Your usual diet", "Su dieta habitual"],
    severity: "minor",
    explanation: [
      "MedlinePlus lists no special food restrictions for this medicine. Follow the directions on your label.",
      "MedlinePlus no indica restricciones especiales de alimentos para este medicamento. Siga las indicaciones de su etiqueta.",
    ],
    guidance: [
      "Ask your pharmacist if you have questions about alcohol or specific foods.",
      "Pregunte a su farmacéutico si tiene dudas sobre el alcohol o algún alimento en particular.",
    ],
    page,
  };
}

function alcohol(
  ingredient: string,
  page: string,
  severity: Severity,
  explanation: [string, string],
  guidance: [string, string] = ALCOHOL_GUIDANCE,
): Entry {
  return {
    ingredient,
    food: ["Alcohol", "Alcohol"],
    severity,
    explanation,
    guidance,
    page,
  };
}

/** "Alcohol can make the side effects of X worse." */
function alcoholWorse(ingredient: string, es: string, page: string): Entry {
  return alcohol(ingredient, page, "moderate", [
    `MedlinePlus says alcohol can make the side effects of ${ingredient} worse.`,
    `MedlinePlus indica que el alcohol puede empeorar los efectos secundarios de ${es}.`,
  ]);
}

/** "Alcohol can add to the drowsiness caused by this medication." */
function alcoholDrowsy(ingredient: string, es: string, page: string): Entry {
  return alcohol(ingredient, page, "moderate", [
    `Alcohol can add to the drowsiness caused by ${ingredient}. MedlinePlus advises avoiding alcoholic drinks while taking it.`,
    `El alcohol puede aumentar la somnolencia que causa ${es}. MedlinePlus aconseja evitar las bebidas alcohólicas mientras lo toma.`,
  ]);
}

/** "Alcohol can increase the risk of serious side effects." */
function alcoholSerious(ingredient: string, es: string, page: string): Entry {
  return alcohol(ingredient, page, "moderate", [
    `MedlinePlus says alcohol can increase the risk of serious side effects from ${ingredient}.`,
    `MedlinePlus indica que el alcohol puede aumentar el riesgo de efectos secundarios graves con ${es}.`,
  ]);
}

/** "Do not drink alcoholic beverages while you are taking X." (opioids and similar) */
function alcoholDoNot(ingredient: string, es: string, page: string): Entry {
  return alcohol(
    ingredient,
    page,
    "major",
    [
      `MedlinePlus says not to drink alcoholic beverages while taking ${ingredient}. Alcohol can make its side effects worse, including dangerous drowsiness.`,
      `MedlinePlus indica que no se deben tomar bebidas alcohólicas mientras se usa ${es}. El alcohol puede empeorar sus efectos secundarios, incluida una somnolencia peligrosa.`,
    ],
    [
      "Tell your pharmacist about any alcohol use, including drinks or medicines that contain alcohol.",
      "Informe a su farmacéutico sobre cualquier consumo de alcohol, incluidas bebidas o medicinas que lo contengan.",
    ],
  );
}

/** "Talk to your doctor about eating grapefruit and drinking grapefruit juice while taking this medication." */
function grapefruit(
  ingredient: string,
  es: string,
  page: string,
  severity: Severity = "moderate",
): Entry {
  return {
    ingredient,
    food: ["Grapefruit", "Toronja"],
    severity,
    explanation: [
      `MedlinePlus says to talk to your doctor about grapefruit and grapefruit juice while taking ${ingredient}. Grapefruit can change how much of some medicines reaches your blood.`,
      `MedlinePlus indica consultar a su médico sobre la toronja y su jugo mientras toma ${es}. La toronja puede cambiar cuánto medicamento llega a la sangre.`,
    ],
    guidance: [
      "Ask your pharmacist whether grapefruit or grapefruit juice matters for your prescription.",
      "Pregunte a su farmacéutico si la toronja o su jugo afectan su receta.",
    ],
    page,
    source: FDA_GRAPEFRUIT,
  };
}

/** "Do not use salt substitutes containing potassium without talking to your doctor." */
function saltSubstitute(ingredient: string, es: string, page: string): Entry {
  return {
    ingredient,
    food: ["Salt substitutes with potassium", "Sustitutos de sal con potasio"],
    severity: "major",
    explanation: [
      `MedlinePlus says not to use potassium-containing salt substitutes with ${ingredient} without talking to your doctor. Too much potassium can affect the heart.`,
      `MedlinePlus indica no usar sustitutos de sal con potasio junto con ${es} sin consultar a su médico. El exceso de potasio puede afectar el corazón.`,
    ],
    guidance: [
      "Check salt-substitute labels for potassium and ask your pharmacist before using one.",
      "Revise si el sustituto de sal contiene potasio y consulte a su farmacéutico antes de usarlo.",
    ],
    page,
  };
}

/** "If your doctor prescribes a low-salt or low-sodium diet, follow these directions carefully." */
function lowSalt(ingredient: string, es: string, page: string): Entry {
  return {
    ingredient,
    food: ["Low-salt diet, if prescribed", "Dieta baja en sal, si se la indican"],
    severity: "minor",
    explanation: [
      `MedlinePlus says to follow a low-salt or low-sodium diet carefully if your doctor prescribes one with ${ingredient}.`,
      `MedlinePlus indica seguir con cuidado una dieta baja en sal o sodio si su médico se la receta junto con ${es}.`,
    ],
    guidance: [
      "Ask your pharmacist or doctor whether a low-salt diet applies to you.",
      "Pregunte a su farmacéutico o médico si una dieta baja en sal aplica en su caso.",
    ],
    page,
  };
}

/** Diuretic pages: low-salt diet and/or extra potassium-rich foods, if prescribed. */
function potassiumFoodsIfPrescribed(ingredient: string, es: string, page: string): Entry {
  return {
    ingredient,
    food: ["Potassium-rich foods · low-salt diet", "Alimentos ricos en potasio · dieta baja en sal"],
    severity: "moderate",
    explanation: [
      `MedlinePlus says your doctor may prescribe a low-salt diet or more potassium-rich foods (such as bananas, prunes, raisins, orange juice) with ${ingredient}. Follow those instructions carefully.`,
      `MedlinePlus indica que su médico puede recetarle una dieta baja en sal o más alimentos ricos en potasio (como plátanos, ciruelas pasas, pasas, jugo de naranja) con ${es}. Siga esas instrucciones con cuidado.`,
    ],
    guidance: [
      "Ask your pharmacist whether you were given any salt or potassium instructions with this medicine.",
      "Pregunte a su farmacéutico si le dieron indicaciones sobre sal o potasio con este medicamento.",
    ],
    page,
  };
}

/** Comfort note: "may be taken with food (or milk) to prevent stomach upset." */
function withFood(
  ingredient: string,
  page: string,
  explanation: [string, string],
  food: [string, string] = ["Food or milk", "Comida o leche"],
): Entry {
  return {
    ingredient,
    food,
    severity: "minor",
    explanation,
    guidance: [
      "Follow your label. Ask your pharmacist about stomach symptoms that do not go away.",
      "Siga su etiqueta. Pregunte a su farmacéutico si las molestias de estómago no desaparecen.",
    ],
    page,
  };
}

/** Statin pages: "Eat a low-fat, low-cholesterol diet." */
function lowFatDiet(ingredient: string, es: string, page: string): Entry {
  return {
    ingredient,
    food: ["Low-fat, low-cholesterol diet", "Dieta baja en grasa y colesterol"],
    severity: "minor",
    explanation: [
      `MedlinePlus says to eat a low-fat, low-cholesterol diet with ${ingredient} and to follow your doctor's diet and exercise advice.`,
      `MedlinePlus indica seguir una dieta baja en grasa y colesterol con ${es} y las recomendaciones de dieta y ejercicio de su médico.`,
    ],
    guidance: [
      "Ask your pharmacist or a dietitian for practical low-fat eating tips.",
      "Pida a su farmacéutico o a un nutricionista consejos prácticos para comer bajo en grasa.",
    ],
    page,
  };
}

/** Diabetes pages: "Be sure to follow all exercise and dietary recommendations made by your doctor or dietitian." */
function diabetesDiet(ingredient: string, es: string, page: string): Entry {
  return {
    ingredient,
    food: ["Your prescribed meal plan", "Su plan de comidas indicado"],
    severity: "minor",
    explanation: [
      `MedlinePlus says to follow all diet and exercise recommendations from your doctor or dietitian while taking ${ingredient}.`,
      `MedlinePlus indica seguir todas las recomendaciones de dieta y ejercicio de su médico o nutricionista mientras toma ${es}.`,
    ],
    guidance: [
      "Ask your pharmacist or dietitian if you are unsure how meals fit with this medicine.",
      "Pregunte a su farmacéutico o nutricionista si no sabe cómo combinar las comidas con este medicamento.",
    ],
    page,
  };
}

/** Corticosteroid pages: doctor may instruct a low-salt, high-potassium, or high-calcium diet. */
function steroidDiet(ingredient: string, es: string, page: string): Entry {
  return {
    ingredient,
    food: ["Low-salt · potassium · calcium diet, if prescribed", "Dieta baja en sal · potasio · calcio, si se la indican"],
    severity: "moderate",
    explanation: [
      `MedlinePlus says your doctor may ask you to follow a low-salt, high-potassium, or high-calcium diet with ${ingredient}. Follow those directions carefully.`,
      `MedlinePlus indica que su médico puede pedirle una dieta baja en sal, alta en potasio o alta en calcio con ${es}. Siga esas indicaciones con cuidado.`,
    ],
    guidance: [
      "Ask your pharmacist whether any diet or supplement instructions came with this prescription.",
      "Pregunte a su farmacéutico si le dieron indicaciones de dieta o suplementos con esta receta.",
    ],
    page,
  };
}

// A small, sourced educational guide, not a complete interaction database.
// Severity is an editorial reading aid, not a MedlinePlus clinical classification.
const GUIDE: Entry[] = [
  // ---- pain / fever -------------------------------------------------------
  alcohol("acetaminophen", "a681004", "major", [
    "MedlinePlus advises against taking acetaminophen if you drink three or more alcoholic drinks every day, because of the risk of liver damage.",
    "MedlinePlus desaconseja tomar acetaminofén si usted bebe tres o más bebidas alcohólicas al día, por el riesgo de daño al hígado.",
  ]),
  withFood("ibuprofen", "a682159", [
    "Ibuprofen may be taken with food or milk to prevent stomach upset. This is a comfort note, not an assurance of safety.",
    "El ibuprofeno puede tomarse con comida o leche para evitar el malestar estomacal. Esta nota no garantiza seguridad.",
  ]),
  withFood("naproxen", "a681029", [
    "Nonprescription naproxen may be taken with food or milk to prevent nausea. This is a comfort note, not an assurance of safety.",
    "El naproxeno sin receta puede tomarse con comida o leche para evitar las náuseas. Esta nota no garantiza seguridad.",
  ]),
  alcohol("aspirin", "a682878", "moderate", [
    "MedlinePlus says that if you drink three or more alcoholic drinks every day, you should ask your doctor whether you should take aspirin.",
    "MedlinePlus indica que, si bebe tres o más bebidas alcohólicas al día, consulte a su médico si debe tomar aspirina.",
  ]),
  alcohol("meloxicam", "a601242", "moderate", [
    "MedlinePlus warns that the risk of stomach bleeding with meloxicam may be higher for people who drink large amounts of alcohol.",
    "MedlinePlus advierte que el riesgo de sangrado estomacal con meloxicam puede ser mayor en personas que beben grandes cantidades de alcohol.",
  ]),
  alcohol(
    "tramadol",
    "a695011",
    "major",
    [
      "MedlinePlus says not to drink alcohol or use products that contain alcohol with tramadol. Doing so raises the risk of serious, life-threatening breathing problems.",
      "MedlinePlus indica no beber alcohol ni usar productos con alcohol junto con tramadol. Hacerlo aumenta el riesgo de problemas respiratorios graves que ponen en peligro la vida.",
    ],
    [
      "Tell your pharmacist about any alcohol use, including cough syrups or other medicines that contain alcohol.",
      "Informe a su farmacéutico sobre cualquier consumo de alcohol, incluidos jarabes u otras medicinas que lo contengan.",
    ],
  ),
  alcoholDoNot("oxycodone", "oxicodona", "a682132"),
  grapefruit("oxycodone", "oxicodona", "a682132"),
  alcoholDoNot("hydrocodone", "hidrocodona", "a614045"),
  grapefruit("hydrocodone", "hidrocodona", "a614045"),
  alcoholDoNot("morphine", "morfina", "a682133"),
  grapefruit("morphine", "morfina", "a682133"),
  alcohol("cyclobenzaprine", "a682514", "moderate", [
    "MedlinePlus says cyclobenzaprine can make the effects of alcohol worse.",
    "MedlinePlus indica que la ciclobenzaprina puede intensificar los efectos del alcohol.",
  ]),

  // ---- blood thinners -----------------------------------------------------
  {
    ingredient: "warfarin",
    food: ["Leafy greens · vitamin K", "Verduras de hoja · vitamina K"],
    severity: "moderate",
    explanation: [
      "Foods with vitamin K can change how warfarin works. MedlinePlus says to eat consistent amounts of vitamin K foods week to week and avoid large amounts of leafy greens.",
      "Los alimentos con vitamina K pueden cambiar el efecto de la warfarina. MedlinePlus indica comer cantidades constantes de vitamina K cada semana y evitar grandes cantidades de verduras de hoja.",
    ],
    guidance: [
      "Keep vitamin K intake consistent. Discuss diet changes with your pharmacist; do not cut out vegetables on your own.",
      "Mantenga constante el consumo de vitamina K. Consulte antes de cambiar su dieta; no elimine verduras por su cuenta.",
    ],
    page: "a682277",
  },
  alcohol("warfarin", "a682277", "minor", [
    "MedlinePlus says to ask your doctor about the safe use of alcoholic beverages while taking warfarin.",
    "MedlinePlus indica preguntar a su médico sobre el consumo seguro de bebidas alcohólicas mientras toma warfarina.",
  ]),
  usualDiet("clopidogrel", "a601040"),
  usualDiet("apixaban", "a613032"),
  usualDiet("rivaroxaban", "a611049"),

  // ---- diabetes -----------------------------------------------------------
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
  diabetesDiet("metformin", "metformina", "a696005"),
  alcohol("glipizide", "a684060", "moderate", [
    "MedlinePlus says alcohol may make the side effects of glipizide worse and, rarely, can cause flushing, headache, nausea, or chest pain.",
    "MedlinePlus indica que el alcohol puede empeorar los efectos secundarios de la glipizida y, en raras ocasiones, causar enrojecimiento, dolor de cabeza, náuseas o dolor en el pecho.",
  ]),
  diabetesDiet("glipizide", "glipizida", "a684060"),
  diabetesDiet("sitagliptin", "sitagliptina", "a606023"),

  // ---- blood pressure / heart ----------------------------------------------
  {
    ingredient: "lisinopril",
    food: ["Salt substitutes with potassium", "Sustitutos de sal con potasio"],
    severity: "major",
    explanation: [
      "MedlinePlus says to talk to your doctor before using salt substitutes containing potassium with lisinopril. Too much potassium can affect the heart.",
      "MedlinePlus indica consultar a su médico antes de usar sustitutos de sal con potasio junto con lisinopril. El exceso de potasio puede afectar el corazón.",
    ],
    guidance: [
      "Check salt-substitute labels for potassium and ask your pharmacist before using one. Follow any prescribed low-salt diet.",
      "Revise si el sustituto de sal contiene potasio y consulte a su farmacéutico antes de usarlo. Siga cualquier dieta baja en sal que le hayan indicado.",
    ],
    page: "a692051",
  },
  saltSubstitute("losartan", "losartán", "a695008"),
  lowSalt("losartan", "losartán", "a695008"),
  saltSubstitute("valsartan", "valsartán", "a697015"),
  lowSalt("valsartan", "valsartán", "a697015"),
  lowSalt("amlodipine", "amlodipino", "a692044"),
  lowSalt("diltiazem", "diltiazem", "a684027"),
  grapefruit("verapamil", "verapamilo", "a684030"),
  alcohol("verapamil", "a684030", "moderate", [
    "MedlinePlus says verapamil may make the effects of alcohol stronger and longer-lasting.",
    "MedlinePlus indica que el verapamilo puede hacer que los efectos del alcohol sean más fuertes y duraderos.",
  ]),
  alcohol("metoprolol", "a682864", "moderate", [
    "MedlinePlus says not to drink alcohol or take medicines that contain alcohol if you take metoprolol extended-release capsules. Other forms of metoprolol carry no special diet note.",
    "MedlinePlus indica no beber alcohol ni tomar medicinas con alcohol si usa cápsulas de liberación prolongada de metoprolol. Otras presentaciones no tienen una nota especial de dieta.",
  ]),
  withFood(
    "carvedilol",
    "a697042",
    [
      "MedlinePlus says to take carvedilol tablets with food, and the extended-release capsule with food in the morning.",
      "MedlinePlus indica tomar las tabletas de carvedilol con comida, y la cápsula de liberación prolongada con comida por la mañana.",
    ],
    ["Take with food", "Tomar con comida"],
  ),
  usualDiet("atenolol", "a684031"),
  alcohol("propranolol", "a682607", "moderate", [
    "MedlinePlus says alcohol may increase the amount of propranolol in your body.",
    "MedlinePlus indica que el alcohol puede aumentar la cantidad de propranolol en el cuerpo.",
  ]),
  alcoholWorse("clonidine", "la clonidina", "a682243"),
  potassiumFoodsIfPrescribed("hydrochlorothiazide", "hidroclorotiazida", "a682571"),
  potassiumFoodsIfPrescribed("furosemide", "furosemida", "a682858"),
  alcohol("furosemide", "a682858", "moderate", [
    "Furosemide can cause dizziness and fainting when you stand up quickly, and MedlinePlus says alcohol can add to these effects.",
    "La furosemida puede causar mareo y desmayo al levantarse rápido, y MedlinePlus indica que el alcohol puede aumentar estos efectos.",
  ]),
  {
    ingredient: "spironolactone",
    food: ["Salt substitutes with potassium", "Sustitutos de sal con potasio"],
    severity: "major",
    explanation: [
      "MedlinePlus says to avoid potassium-containing salt substitutes while taking spironolactone. This medicine already raises potassium, and too much can affect the heart.",
      "MedlinePlus indica evitar los sustitutos de sal con potasio mientras toma espironolactona. Este medicamento ya eleva el potasio, y el exceso puede afectar el corazón.",
    ],
    guidance: [
      "Check salt-substitute labels for potassium and ask your pharmacist before using one.",
      "Revise si el sustituto de sal contiene potasio y consulte a su farmacéutico antes de usarlo.",
    ],
    page: "a682627",
  },
  {
    ingredient: "spironolactone",
    food: ["Potassium-rich foods", "Alimentos ricos en potasio"],
    severity: "moderate",
    explanation: [
      "MedlinePlus says to talk with your doctor about how much potassium-rich food (such as bananas, prunes, raisins, orange juice) you may have with spironolactone.",
      "MedlinePlus indica hablar con su médico sobre cuántos alimentos ricos en potasio (como plátanos, ciruelas pasas, pasas, jugo de naranja) puede comer con espironolactona.",
    ],
    guidance: [
      "Ask your pharmacist about potassium-rich foods and any reduced-salt diet you were given.",
      "Pregunte a su farmacéutico sobre los alimentos ricos en potasio y cualquier dieta baja en sal que le hayan indicado.",
    ],
    page: "a682627",
  },
  alcohol("spironolactone", "a682627", "moderate", [
    "MedlinePlus says drinking alcohol with spironolactone may cause dizziness, lightheadedness, and fainting when you stand up quickly.",
    "MedlinePlus indica que beber alcohol con espironolactona puede causar mareo, aturdimiento y desmayo al levantarse rápido.",
  ]),
  {
    ingredient: "potassium chloride",
    food: ["Salt substitutes with potassium", "Sustitutos de sal con potasio"],
    severity: "major",
    explanation: [
      "Many salt substitutes contain potassium, and MedlinePlus says to tell your doctor if you use one. Extra potassium adds to what this supplement already gives you.",
      "Muchos sustitutos de sal contienen potasio, y MedlinePlus indica avisar a su médico si usa uno. El potasio adicional se suma al que ya aporta este suplemento.",
    ],
    guidance: [
      "Tell your pharmacist about salt substitutes and potassium-rich foods so your dose can be reviewed.",
      "Informe a su farmacéutico sobre sustitutos de sal y alimentos ricos en potasio para que revisen su dosis.",
    ],
    page: "a601099",
  },
  withFood(
    "potassium chloride",
    "a601099",
    [
      "MedlinePlus says potassium is usually taken with or right after meals, with a full glass of water or fruit juice.",
      "MedlinePlus indica que el potasio suele tomarse con las comidas o justo después, con un vaso lleno de agua o jugo de fruta.",
    ],
    ["With meals and a full glass of water", "Con comidas y un vaso lleno de agua"],
  ),
  {
    ingredient: "amiodarone",
    food: ["Grapefruit juice", "Jugo de toronja"],
    severity: "major",
    explanation: [
      "MedlinePlus says not to drink grapefruit juice while taking amiodarone. Grapefruit can raise the amount of amiodarone in your blood.",
      "MedlinePlus indica no beber jugo de toronja mientras toma amiodarona. La toronja puede aumentar la cantidad de amiodarona en la sangre.",
    ],
    guidance: [
      "Ask your pharmacist about grapefruit and grapefruit juice before drinking any.",
      "Pregunte a su farmacéutico sobre la toronja y su jugo antes de consumirlos.",
    ],
    page: "a687009",
    source: FDA_GRAPEFRUIT,
  },

  // ---- cholesterol --------------------------------------------------------
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
    source: FDA_GRAPEFRUIT,
  },
  alcoholSerious("simvastatin", "la simvastatina", "a692030"),
  grapefruit("atorvastatin", "atorvastatina", "a600045"),
  alcoholSerious("atorvastatin", "la atorvastatina", "a600045"),
  lowFatDiet("atorvastatin", "atorvastatina", "a600045"),
  alcoholSerious("rosuvastatin", "la rosuvastatina", "a603033"),
  lowFatDiet("rosuvastatin", "rosuvastatina", "a603033"),
  alcoholSerious("pravastatin", "la pravastatina", "a692025"),
  lowFatDiet("pravastatin", "pravastatina", "a692025"),

  // ---- thyroid / stomach --------------------------------------------------
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
  grapefruit("levothyroxine", "levotiroxina", "a682461"),
  usualDiet("omeprazole", "a693050"),
  usualDiet("pantoprazole", "a601246"),
  usualDiet("famotidine", "a687011"),

  // ---- mood / sleep / nerves ----------------------------------------------
  alcoholWorse("sertraline", "la sertralina", "a697048"),
  alcoholWorse("escitalopram", "el escitalopram", "a603005"),
  alcoholWorse("citalopram", "el citalopram", "a699001"),
  alcoholWorse("fluoxetine", "la fluoxetina", "a689006"),
  alcoholWorse("venlafaxine", "la venlafaxina", "a694020"),
  alcoholWorse("bupropion", "el bupropión", "a695033"),
  alcoholSerious("duloxetine", "la duloxetina", "a604030"),
  alcoholWorse("trazodone", "la trazodona", "a681038"),
  grapefruit("trazodone", "trazodona", "a681038"),
  grapefruit("alprazolam", "alprazolam", "a684001"),
  alcoholWorse("lorazepam", "el lorazepam", "a682053"),
  alcohol("zolpidem", "a693025", "major", [
    "MedlinePlus says not to drink alcohol during treatment with zolpidem. Alcohol can make its side effects worse.",
    "MedlinePlus indica no beber alcohol durante el tratamiento con zolpidem. El alcohol puede empeorar sus efectos secundarios.",
  ]),
  alcohol("gabapentin", "a694007", "moderate", [
    "MedlinePlus reminds that alcohol can add to the drowsiness caused by gabapentin.",
    "MedlinePlus recuerda que el alcohol puede aumentar la somnolencia que causa la gabapentina.",
  ]),
  alcoholWorse("hydroxyzine", "la hidroxizina", "a682866"),
  usualDiet("methotrexate", "a682019"),

  // ---- steroids -----------------------------------------------------------
  steroidDiet("prednisone", "prednisona", "a601102"),
  grapefruit("prednisone", "prednisona", "a601102"),
  steroidDiet("prednisolone", "prednisolona", "a615042"),
  {
    ingredient: "methylprednisolone",
    food: ["Low-salt · potassium-rich · high-protein diet, if prescribed", "Dieta baja en sal · rica en potasio · alta en proteína, si se la indican"],
    severity: "moderate",
    explanation: [
      "MedlinePlus says your doctor may ask you to follow a low-sodium, potassium-rich, or high-protein diet with methylprednisolone. Follow those directions.",
      "MedlinePlus indica que su médico puede pedirle una dieta baja en sodio, rica en potasio o alta en proteína con metilprednisolona. Siga esas indicaciones.",
    ],
    guidance: [
      "Ask your pharmacist whether any diet instructions came with this prescription.",
      "Pregunte a su farmacéutico si le dieron indicaciones de dieta con esta receta.",
    ],
    page: "a682795",
  },
  withFood("methylprednisolone", "a682795", [
    "Methylprednisolone may upset the stomach, and MedlinePlus says to take it with food or milk.",
    "La metilprednisolona puede causar malestar estomacal, y MedlinePlus indica tomarla con comida o leche.",
  ]),
  alcohol("methylprednisolone", "a682795", "moderate", [
    "MedlinePlus says to limit alcohol with methylprednisolone if you have a history of ulcers or take large doses of aspirin, because it makes the stomach more sensitive to irritation.",
    "MedlinePlus indica limitar el alcohol con metilprednisolona si tiene antecedentes de úlceras o toma dosis altas de aspirina, porque hace el estómago más sensible a la irritación.",
  ]),

  // ---- infections ---------------------------------------------------------
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
    ingredient: "ciprofloxacin",
    food: ["Caffeine · coffee, tea, energy drinks", "Cafeína · café, té, bebidas energéticas"],
    severity: "moderate",
    explanation: [
      "MedlinePlus says not to have a lot of caffeine with ciprofloxacin. It can increase nervousness, sleeplessness, and heart pounding caused by caffeine.",
      "MedlinePlus indica no consumir mucha cafeína con ciprofloxacina. Puede aumentar el nerviosismo, el insomnio y las palpitaciones que causa la cafeína.",
    ],
    guidance: [
      "Ask your pharmacist how much caffeine is reasonable, and drink plenty of water or other fluids.",
      "Pregunte a su farmacéutico cuánta cafeína es razonable, y beba abundante agua u otros líquidos.",
    ],
    page: "a688016",
  },
  withFood("amoxicillin", "a685001", [
    "MedlinePlus says amoxicillin may be taken with food to prevent stomach upset. Otherwise, continue your normal diet.",
    "MedlinePlus indica que la amoxicilina puede tomarse con comida para evitar el malestar estomacal. Por lo demás, continúe su dieta habitual.",
  ]),
  usualDiet("azithromycin", "a697037"),
  withFood("doxycycline", "a682063", [
    "MedlinePlus says to drink a full glass of water with each dose of doxycycline, and that you may take it with food if it upsets your stomach.",
    "MedlinePlus indica beber un vaso lleno de agua con cada dosis de doxiciclina, y que puede tomarla con comida si le causa malestar estomacal.",
  ]),
  usualDiet("cephalexin", "a682733"),
  withFood(
    "nitrofurantoin",
    "a682291",
    [
      "MedlinePlus says nitrofurantoin is usually taken with food. Otherwise, continue your normal diet.",
      "MedlinePlus indica que la nitrofurantoína suele tomarse con comida. Por lo demás, continúe su dieta habitual.",
    ],
    ["Take with food", "Tomar con comida"],
  ),
  alcohol(
    "metronidazole",
    "a689011",
    "major",
    [
      "MedlinePlus says not to drink alcohol or use products with alcohol or propylene glycol while taking metronidazole and for at least 3 days after the last dose. Together they can cause nausea, vomiting, cramps, headache, and flushing.",
      "MedlinePlus indica no beber alcohol ni usar productos con alcohol o propilenglicol mientras toma metronidazol y durante al menos 3 días después de la última dosis. Juntos pueden causar náuseas, vómitos, cólicos, dolor de cabeza y enrojecimiento.",
    ],
    [
      "Ask your pharmacist which products contain alcohol or propylene glycol, including mouthwash and cough syrups.",
      "Pregunte a su farmacéutico qué productos contienen alcohol o propilenglicol, incluidos enjuagues bucales y jarabes.",
    ],
  ),
  usualDiet("fluconazole", "a690002"),

  // ---- allergy / breathing ------------------------------------------------
  alcoholDrowsy("cetirizine", "la cetirizina", "a623043"),
  alcoholDrowsy("diphenhydramine", "la difenhidramina", "a682539"),
  usualDiet("loratadine", "a697038"),
  {
    ingredient: "fexofenadine",
    food: ["Fruit juice · orange, grapefruit, apple", "Jugo de fruta · naranja, toronja, manzana"],
    severity: "moderate",
    explanation: [
      "MedlinePlus says to take fexofenadine with water and not with fruit juices such as orange, grapefruit, or apple juice.",
      "MedlinePlus indica tomar la fexofenadina con agua y no con jugos de fruta como naranja, toronja o manzana.",
    ],
    guidance: [
      "Take it with water. Ask your pharmacist about timing if you drink juice with meals.",
      "Tómela con agua. Pregunte a su farmacéutico sobre el horario si bebe jugo con las comidas.",
    ],
    page: "a697035",
  },
  alcoholWorse("promethazine", "la prometazina", "a682284"),
  usualDiet("montelukast", "a600014"),
  usualDiet("albuterol", "a607004"),

  // ---- other --------------------------------------------------------------
  {
    ingredient: "allopurinol",
    food: ["Water · plenty of fluids", "Agua · abundantes líquidos"],
    severity: "minor",
    explanation: [
      "MedlinePlus says to drink at least eight 8-ounce cups of water or other liquids each day while taking allopurinol, unless your doctor says otherwise.",
      "MedlinePlus indica beber al menos ocho vasos de 8 onzas (240 ml) de agua u otros líquidos al día mientras toma alopurinol, salvo que su médico indique otra cosa.",
    ],
    guidance: [
      "Ask your pharmacist if you have a condition that limits how much fluid you should drink.",
      "Pregunte a su farmacéutico si tiene alguna condición que limite cuánto líquido debe beber.",
    ],
    page: "a682673",
  },
  alcohol("allopurinol", "a682673", "minor", [
    "MedlinePlus says to ask your doctor about the safe use of alcoholic beverages while taking allopurinol.",
    "MedlinePlus indica preguntar a su médico sobre el consumo seguro de bebidas alcohólicas mientras toma alopurinol.",
  ]),
];

/** Salt/ester words that appear after the generic name ("warfarin sodium", "atorvastatin calcium"). */
const SALT_SUFFIXES = [
  "hydrochloride",
  "hcl",
  "sodium",
  "potassium",
  "sulfate",
  "acetate",
  "calcium",
  "maleate",
  "succinate",
  "tartrate",
  "besylate",
  "mesylate",
  "citrate",
];
const SALT_SUFFIX_RE = new RegExp(`\\s+(?:${SALT_SUFFIXES.join("|")})$`);

/** Lower-case, drop parentheticals, drop trailing salt words. "Warfarin Sodium" → "warfarin". */
export function normalizeIngredient(name: string): string {
  let s = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // "potassium chloride" is untouched: the suffix must follow another word.
  while (SALT_SUFFIX_RE.test(s)) s = s.replace(SALT_SUFFIX_RE, "");
  return s;
}

/** Ordered lookup keys: canonical ingredient first, then brand → generic, then the name itself. */
function guideKeyFor(medicine: Med): string {
  const name = medicine.name ?? "";
  const parenthetical = name.match(/\(([^)]+)\)/)?.[1]; // "Lipitor (atorvastatin)" → "atorvastatin"
  const bare = name.replace(/\([^)]*\)/g, " ").trim(); // "Lipitor (atorvastatin)" → "Lipitor"
  const candidates = [
    medicine.ingredientName,
    genericFor(name),
    genericFor(bare),
    parenthetical,
    name,
  ]
    .filter((c): c is string => !!c && c.trim().length > 0)
    .map(normalizeIngredient)
    .filter((c) => c.length > 0);
  return (
    candidates.find((c) => GUIDE.some((e) => e.ingredient === c)) ??
    candidates[0] ??
    ""
  );
}

/** Distinct ingredients with at least one guide entry (for coverage reporting). */
export const GUIDE_INGREDIENTS: string[] = Array.from(
  new Set(GUIDE.map((e) => e.ingredient)),
);

export function checkFoods(
  meds: Med[],
  lang: "en" | "es" = "en",
): FoodResult[] {
  const i = lang === "es" ? 1 : 0;
  return meds.flatMap((medicine) => {
    const key = guideKeyFor(medicine);
    const entries = GUIDE.filter((e) => e.ingredient === key);
    if (!entries.length)
      return [
        {
          id: `${medicine.rxcui}-unknown`,
          medicine,
          food: i
            ? "Sin notas de alimentos en nuestra guía"
            : "No food notes in our guide yet",
          severity: "unknown" as Severity,
          explanation: i
            ? "Nuestra guía aún no tiene una nota verificada sobre alimentos para este medicamento. Es un vacío de nuestra guía, no una señal de que sea seguro o inseguro."
            : "Our guide does not have a verified food note for this medicine yet. That is a gap in our guide, not a sign it is safe or unsafe.",
          guidance: i
            ? "Consulte la etiqueta y pregunte a un farmacéutico sobre comidas y bebidas."
            : "Check your label and ask a pharmacist about foods and drinks.",
        },
      ];
    return entries.map((e, n) => ({
      id: `${medicine.rxcui}-${e.page}-${n}`,
      medicine,
      food: e.food[i],
      severity: e.severity,
      explanation: e.explanation[i],
      guidance: e.guidance[i],
      source: e.source ?? medlinePage(e.page),
    }));
  });
}
