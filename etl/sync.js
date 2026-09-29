const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../mobile/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runETL() {
  try {
    console.log('Fetching skincare products from Open Beauty Facts...');
    
    // Fetching the first 250 skincare products (you can increase page_size or loop through pages later)
    const response = await fetch('https://world.openbeautyfacts.org/category/skincare.json?page_size=250');
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const rawData = await response.json();

    console.log(`Extracting data for ${rawData.products.length} products...`);
    const productList = [];
    
    for (const product of rawData.products) {
      // Skip products that are missing a barcode or a name
      if (!product.code || !product.product_name) continue;

      productList.push({
        barcode: product.code,
        name: product.product_name,
        brand: product.brands || 'Unknown Brand',
        // Grabs the plain text ingredient list (e.g., "Water, Glycerin, Niacinamide...")
        ingredients_text: product.ingredients_text_en || product.ingredients_text || 'Ingredients not listed',
        image_url: product.image_front_url || null
      });
    }

    console.log(`Found ${productList.length} valid products. Upserting into Supabase...`);
    
    // Upload in batches to prevent database timeouts
    const BATCH_SIZE = 100;
    for (let i = 0; i < productList.length; i += BATCH_SIZE) {
      const batch = productList.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from('products')
        .upsert(batch, { onConflict: 'barcode' }); 

      if (error) {
        console.error(`Error uploading batch ${i}:`, error.message);
      } else {
        console.log(`Successfully uploaded batch ${i} to ${i + batch.length}`);
      }
    }

    console.log('🎉 Product Pipeline Complete! Supabase is fully synced.');

  } catch (error) {
    console.error('❌ Pipeline Failed:', error.message);
  }
}

runETL();