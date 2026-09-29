async function testProductAPI() {
  try {
    console.log('Fetching live skincare products from Open Beauty Facts...\n');
    
    // Fetching just a small sample of 5 products for the test
    const response = await fetch('https://world.openbeautyfacts.org/category/skincare.json?page_size=5');
    const rawData = await response.json();
    
    console.log(`✅ Successfully connected! Found ${rawData.count} total skincare products in their database.\n`);
    
    const productList = [];
    let count = 0;

    for (const product of rawData.products) {
      // Skip if missing barcode or name
      if (!product.code || !product.product_name) continue;

      // Only process the first 3 items for the console test
      if (count < 3) {
        console.log(`\n--- RAW PAYLOAD ${count + 1} (Directly from API) ---`);
        // We only log a few specific keys here because the full raw product payload is massive (hundreds of lines long)
        console.log(JSON.stringify({
          code: product.code,
          product_name: product.product_name,
          brands: product.brands,
          ingredients_text_en: product.ingredients_text_en,
          image_front_url: product.image_front_url
        }, null, 2));

        productList.push({
          barcode: product.code,
          name: product.product_name,
          brand: product.brands || 'Unknown Brand',
          ingredients_text: product.ingredients_text_en || product.ingredients_text || 'Ingredients not listed',
          image_url: product.image_front_url || null
        });
      }
      count++;
    }

    console.log('\n--- TRANSFORMED DATA (What gets sent to Supabase) ---');
    console.log(JSON.stringify(productList, null, 2));

  } catch (error) {
    console.error('❌ Failed to fetch data:', error.message);
  }
}

testProductAPI();