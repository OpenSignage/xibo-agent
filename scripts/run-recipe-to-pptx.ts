/*
 * Test runner for presenter-recipe-to-pptx workflow
 */
import { recipeToPptxWorkflow } from '../src/mastra/workflows/presenter/recipeToPptx';

async function main() {
  const recipeFileName = process.argv[2] || 'sample-recipe.json';
  const fileNameBase = process.argv[3] || 'recipe-test';
  const templateName = process.argv[4] || 'default.json';
  const res = await recipeToPptxWorkflow.run({ inputData: { recipeFileName, fileNameBase, templateName } });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

