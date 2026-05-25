/**
 * Heuristic: show Klaus (chef) as contextual coach on vocab practice when the topic skews restaurant / food service.
 */
export function shouldShowKlausChefGuide(input: {
  selTag: string;
  urlTopic: string;
  tags: ReadonlyArray<{ name: string; localizedLabel?: string | null }>;
}): boolean {
  const labelForSel =
    input.tags.find((t) => t.name === input.selTag)?.localizedLabel ?? "";
  const blob = [input.selTag, input.urlTopic, labelForSel].join(" ").toLowerCase();
  return /restaurant|nhà hàng|gastronom|gastronomy|küche|kitchen|food service|food-service|ẩm thực|ăn uống|đầu bếp|chef|bếp|hotel|dining|café|cafe|bar\b|service|gaststätte|bewirtung|speisen|nhà hàng|comida/.test(
    blob,
  );
}
