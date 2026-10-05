import { useState } from 'react';
import { scaleRecipe, type Recipe } from '@/data/recipes';
import { useRecipes } from '@/hooks/useRecipes';
import { ui } from '@/i18n/ui';
import useToolNumber from '@/hooks/useToolNumber';
import './practicalTools.css';
const emptyRecipe = (): Recipe => ({ id: crypto.randomUUID(), name: '', servings: '4', ingredients: [{ id: crypto.randomUUID(), name: '', quantity: '', unit: '' }] });
function RecipeEditor() {
  const number = useToolNumber();
  const { recipes, loading, save, remove, sessionOnly } = useRecipes();
  const [recipe, setRecipe] = useState<Recipe>(emptyRecipe), [target, setTarget] = useState('6'), [message, setMessage] = useState(''), [deleteId, setDeleteId] = useState<string | null>(null);
  const scaled = scaleRecipe(recipe, target);
  const update = (next: Recipe) => { setRecipe(next); setMessage(''); };
  return <section className="pt-workbench" aria-label={ui('Recipe Scaler')}>
    <div className="pt-inputs"><label>{ui('Recipe name')}<input value={recipe.name} maxLength={100} placeholder={ui('Give your recipe a name')} onChange={event => update({ ...recipe, name: event.target.value })} /></label><label>{ui('Original servings')}<input inputMode="decimal" value={recipe.servings} maxLength={40} onChange={event => update({ ...recipe, servings: event.target.value })} /></label><label>{ui('Target servings')}<input inputMode="decimal" value={target} maxLength={40} onChange={event => setTarget(event.target.value)} /></label></div>
    <p className="lt-storage-note">{ui('Quantities accept decimals or fractions such as 1/2. Use positive servings up to 1,000 and ingredient quantities from 0 to 1,000,000.')}</p>
    <div className="pt-ingredients">{recipe.ingredients.map((ingredient, index) => <fieldset key={ingredient.id}><legend>{ui('Ingredient')} {index + 1}</legend><label>{ui('Ingredient name')}<input value={ingredient.name} maxLength={100} onChange={event => update({ ...recipe, ingredients: recipe.ingredients.map(item => item.id === ingredient.id ? { ...item, name: event.target.value } : item) })} /></label><label>{ui('Quantity')}<input inputMode="text" value={ingredient.quantity} maxLength={40} onChange={event => update({ ...recipe, ingredients: recipe.ingredients.map(item => item.id === ingredient.id ? { ...item, quantity: event.target.value } : item) })} /></label><label>{ui('Unit')}<input value={ingredient.unit} maxLength={30} placeholder="g / mL" onChange={event => update({ ...recipe, ingredients: recipe.ingredients.map(item => item.id === ingredient.id ? { ...item, unit: event.target.value } : item) })} /></label><button type="button" className="lt-text-link" disabled={recipe.ingredients.length === 1} aria-label={`${ui('Remove ingredient')} ${index + 1}`} onClick={() => update({ ...recipe, ingredients: recipe.ingredients.filter(item => item.id !== ingredient.id) })}>{ui('Remove ingredient')}</button></fieldset>)}</div>
    <button className="lt-button" type="button" disabled={recipe.ingredients.length >= 100} onClick={() => update({ ...recipe, ingredients: [...recipe.ingredients, { id: crypto.randomUUID(), name: '', quantity: '', unit: '' }] })}>{ui('Add ingredient')}</button>
    <div className="pt-result" aria-live="polite">{scaled ? <><p className="lt-eyebrow">{ui('Scale factor')}</p><output className="pt-output">{number(scaled.factor)}×</output><ul className="pt-scaled-list">{recipe.ingredients.map((item, index) => <li key={item.id}><span>{item.name}</span><strong>≈ {number(scaled.quantities[index])} {item.unit}</strong></li>)}</ul><p>{ui('Independent check')}: {number(scaled.factor)} × {recipe.servings} ≈ {target}</p></> : <p>{ui('Add named ingredients with valid quantities and positive serving counts to see the scaled recipe.')}</p>}</div>
    <p className="lt-notice">{ui('Ingredient quantities scale proportionally. Oven temperature, pan size, and cooking time may need separate adjustments.')}</p>
    <div className="pt-actions"><button className="lt-button primary" type="button" disabled={loading || !scaled || !recipe.name.trim()} onClick={() => setMessage(save(recipe) ? 'Recipe saved.' : 'Could not save. Check the recipe or the limit of 50 saved recipes.')}>{ui('Save recipe')}</button><button className="lt-button" type="button" onClick={() => { update(emptyRecipe()); setTarget('6'); }}>{ui('New recipe')}</button></div>
    <p role="status">{ui(message)}</p><p className="lt-storage-note">{ui(sessionOnly ? 'Storage is unavailable. Recipes stay available only for this session.' : 'Recipes are saved on this browser, separately for each account. Device sync comes later.')}</p>
    <section className="pt-working"><h3>{ui('Saved recipes')}</h3>{recipes.length === 0 ? <p>{ui('Your saved recipes will appear here.')}</p> : <ul className="pt-saved-recipes">{recipes.map(item => <li key={item.id}><button className="lt-text-link" type="button" onClick={() => { update({ ...item, ingredients: item.ingredients.map(ingredient => ({ ...ingredient })) }); setTarget(item.servings); }}>{item.name}</button><button type="button" className="lt-text-link" disabled={loading} aria-label={`${ui('Delete recipe')}: ${item.name}`} onClick={() => setDeleteId(item.id)}>{ui('Delete recipe')}</button>{deleteId === item.id && <div><p>{ui('Delete this saved recipe?')}</p><button type="button" className="lt-button" disabled={loading} onClick={() => { remove(item.id); setDeleteId(null); }}>{ui('Delete recipe')}</button><button type="button" className="lt-button" onClick={() => setDeleteId(null)}>{ui('Cancel')}</button></div>}</li>)}</ul>}</section>
  </section>;
}
export default function RecipeScaler() {
  const { account } = useRecipes();
  return <RecipeEditor key={account} />;
}
