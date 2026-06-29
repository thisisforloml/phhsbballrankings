const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "src");
const replacements = [
  ["OnCourt Rankings Philippines", "Peach Basket"],
  ["OnCourt Rankings PH", "Peach Basket Rankings PH"],
  ["OnCourt player rankings", "Peach Basket player rankings"],
  ["OnCourt administration", "Peach Basket administration"],
  ["OnCourt Admin", "Peach Basket Admin"],
  ["ONCOURT ADMIN", "PEACH BASKET ADMIN"],
  ["Search OnCourt players", "Search Peach Basket players"],
  ["Search OnCourt teams", "Search Peach Basket teams"],
  ["Suggested OnCourt player", "Suggested Peach Basket player"],
  ["Suggested OnCourt team", "Suggested Peach Basket team"],
  ["matching against OnCourt", "matching against Peach Basket"],
  ["teams in OnCourt before", "teams in Peach Basket before"],
  ["teams in OnCourt and", "teams in Peach Basket and"],
  ["Your OnCourt rating", "Your Peach Basket rating"],
  ["OnCourt score", "Peach Basket score"],
  ["OnCourt scores", "Peach Basket scores"],
  ["OnCourt&apos;s", "Peach Basket&apos;s"],
  ["rankings on OnCourt.", "rankings on Peach Basket."],
  ["history on OnCourt.", "history on Peach Basket."],
  ["Partner With OnCourt Rankings PH", "Partner With Peach Basket"],
  ["partners with OnCourt Rankings PH", "partners with Peach Basket"],
  ["For OnCourt administrators", "For Peach Basket administrators"],
  ["cannot access OnCourt portals", "cannot access Peach Basket portals"],
  ["New to OnCourt?", "New to Peach Basket?"],
  ["What is OnCourt Rankings PH?", "What is Peach Basket Rankings PH?"],
  ["How OnCourt Rankings PH", "How Peach Basket Rankings PH"],
  ["About OnCourt Rankings PH", "About Peach Basket Rankings PH"],
  ["OnCourt-Admin-UrlImport", "PeachBasket-Admin-UrlImport"],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      let text = fs.readFileSync(full, "utf8");
      const original = text;
      for (const [from, to] of replacements) {
        text = text.split(from).join(to);
      }
      if (text !== original) {
        fs.writeFileSync(full, text);
        console.log(path.relative(root, full));
      }
    }
  }
}

walk(root);
