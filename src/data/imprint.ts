// Replace each empty values array with the actual operator details. Values (names,
// addresses, IDs) are shared across languages; labels and placeholders are translated.
// Remove conditional sections that do not apply to the operator.
export const imprintDetails = [
  { title: 'Website operator', placeholders: ['Full name or company name', 'Legal form and authorized representative, if applicable'], values: [] as string[] },
  { title: 'Postal address', placeholders: ['Street and house number', 'Postal code, city and country'], values: [] as string[] },
  { title: 'Contact', placeholders: ['Email address', 'Phone number or another direct contact method'], values: [] as string[] },
  { title: 'Registration, if applicable', placeholders: ['Register, court and registration number'], values: [] as string[] },
  { title: 'Tax identification, if applicable', placeholders: ['VAT ID or economic identification number'], values: [] as string[] },
  { title: 'Regulated activity, if applicable', placeholders: ['Supervisory authority, chamber, professional title, awarding country and professional rules'], values: [] as string[] },
  { title: 'Editorial responsibility, if applicable', placeholders: ['Name and address of the person responsible for editorial content'], values: [] as string[] },
  { title: 'Consumer dispute resolution, if applicable', placeholders: ['State whether participation is voluntary or mandatory and identify the competent dispute resolution body, if applicable'], values: [] as string[] },
];
