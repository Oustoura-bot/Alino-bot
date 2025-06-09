// image_search.js
import axios from 'axios';
import cheerio from 'cheerio';

async function searchGoogleImages(query) {
  if (!query) {
    console.error('يرجى تقديم استعلام بحث.');
    return [];
  }
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  try {
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const imageResults = [];

    $('img').each((i, element) => {
      const imgSrc = $(element).attr('src');
      if (imgSrc && imgSrc.startsWith('http')) {
        imageResults.push({
          source: 'Google Images',
          imageUrl: imgSrc,
          pageUrl: url
        });
      }
    });

    $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent) {
            // Simplified example
        }
    });

    return imageResults.slice(0, 20);

  } catch (error) {
    console.error(`حدث خطأ أثناء البحث في Google Images: ${error.message}`);
    return [];
  }
}


async function searchBingImages(query) {
  if (!query) {
    console.error("يرجى تقديم استعلام بحث.");
    return [];
  }
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.bing.com/images/search?q=${encodedQuery}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  try {
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const imageResults = [];

    $('a.iusc').each((i, element) => {
      const m = $(element).attr('m');
      if (m) {
        try {
          const metadata = JSON.parse(m);
          if (metadata && metadata.murl) {
            imageResults.push({
              source: 'Bing Images',
              imageUrl: metadata.murl,
              pageUrl: metadata.purl,
              thumbnailUrl: metadata.turl
            });
          }
        } catch (e) {
          // console.error('Error parsing Bing image metadata:', e.message);
        }
      }
    });
    
    if (imageResults.length === 0) {
        $('img').each((i, element) => {
            const imgSrc = $(element).attr('src');
            const altText = $(element).attr('alt');
            if (imgSrc && imgSrc.startsWith('http') && (!altText || !altText.toLowerCase().includes('logo'))) {
                imageResults.push({
                    source: 'Bing Images (Fallback)',
                    imageUrl: imgSrc,
                    pageUrl: url
                });
            }
        });
    }

    return imageResults.slice(0, 20);

  } catch (error) {
    console.error(`حدث خطأ أثناء البحث في Bing Images: ${error.message}`);
    return [];
  }
}

export { searchGoogleImages, searchBingImages };

