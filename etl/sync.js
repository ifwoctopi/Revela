const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../mobile/.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runETL() {
  try {
    console.log('Starting full database sync from Open Beauty Facts...');
    
    let page = 1;
    let keepFetching = true;
    let totalProcessed = 0;

    while (keepFetching) {
      console.log(`\nFetching page ${page}...`);
      
      // Fetch 250 products at a time, iterating the page variable each loop
      const response = await fetch(`https://world.openbeautyfacts.org/category/skincare.json?page_size=250&page=${page}`);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const rawData = await response.json();

      // If the API returns an empty array, we've reached the end of the database
      if (!rawData.products || rawData.products.length === 0) {
        console.log('Reached the end of the API database.');
        keepFetching = false;
        break;
      }

      const productList = [];
      for (const product of rawData.products) {
        if (!product.code || !product.product_name) continue;

        productList.push({
          barcode: product.code,
          name: product.product_name,
          brand: product.brands || 'Unknown Brand',
          ingredients_text: product.ingredients_text_en || product.ingredients_text || 'Ingredients not listed',
          image_url: product.image_front_url || null
        });
      }

      if (productList.length > 0) {
        console.log(`Found ${productList.length} valid products on page ${page}. Upserting...`);
        
        // Supabase easily handles 250 records per request, so we upsert the whole page at once
        const { error } = await supabase
          .from('products')
          .upsert(productList, { onConflict: 'barcode' }); 

        if (error) {
          console.error(`Error uploading page ${page}:`, error.message);
        } else {
          totalProcessed += productList.length;
          console.log(`Success! Total synced so far: ${totalProcessed}`);
        }
      } else {
         console.log(`No valid products on page ${page}, skipping upsert.`);
      }

      // Move to the next page for the next loop iteration
      page++;
    }

    console.log(`\n🎉 Pipeline Complete! Fully synced and updated ${totalProcessed} total products.`);

  } catch (error) {
    console.error('\n❌ Pipeline Failed:', error.message);
  }
}

runETL();