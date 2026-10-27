# Meal / recipe library

## Coach (library editor)
- Recipe: name, photo, categories (breakfast, lunch, dinner, snack, pre-training, post-training, competition, dessert — fixed list), prep time (min), servings (number of portions), diet flags (vegetarian, vegan, gluten-free, lactose-free), allergens (EU 14 checkboxes).
- Ingredients: food from the food database + grams, or free-text ingredient without nutrition (marks nutrition as incomplete).
- Instructions: ordered steps. Substitutions: list of "instead of X use Y" + note.
- Nutrition per portion and per recipe computed from ingredients (pure function, tested).
- Draft / published; clients see only published recipes of their coach. Create, edit, duplicate, archive.

## Client
- Library: recipe cards (photo, name, prep time, kcal + protein per portion), category chips, search by name or ingredient, diet-flag filters, "Saved" tab (heart toggle per client).
- Recipe detail: portion selector (scales ingredient amounts), ingredients, instructions, nutrition for selected portions, substitutions, allergens.
- Warning banner when the recipe's allergens match the client's allergies, or it conflicts with their diet type (e.g. vegan client, non-vegan recipe).
- CALORIES mode: "Log this" (date, meal, portions) → snapshot entry.
- Recipes linked from nutrition plan meals open this screen.
