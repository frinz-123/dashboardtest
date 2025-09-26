// Simple test script to check seller analytics API
const fetch = require('node-fetch')

async function testSellerAPI() {
  try {
    console.log('Testing seller analytics API...')
    const response = await fetch('http://localhost:3002/api/clientes?action=seller-analytics')

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`)
      return
    }

    const data = await response.json()
    console.log('API Response:', {
      success: data.success,
      totalSellers: data.data?.totalSellers,
      sellersCount: data.data?.sellers?.length,
      firstSeller: data.data?.sellers?.[0]?.vendedor
    })

    if (data.data?.sellers?.length > 0) {
      console.log('✅ Seller data found!')
    } else {
      console.log('❌ No seller data returned')
    }

  } catch (error) {
    console.error('Error testing API:', error.message)
  }
}

testSellerAPI()