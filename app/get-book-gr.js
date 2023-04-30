const axios = require('axios');
const cheerio = require('cheerio');

function scrapeBookDetails(isbn) {
  console.log('CALL FUNC!')
  const url = `https://www.goodreads.com/book/isbn/${isbn}`;

  return axios.get(url)
    .then(response => {
      const $ = cheerio.load(response.data);
      const bookTitle = $('h1.Text.Text__title1[data-testid="bookTitle"]').text();
      const authorName = $('div#ContributorLinksList');
      const avgRating = $('span[itemprop="ratingValue"]').text().trim();
      const ratingCount = $('span[itemprop="ratingCount"]').text().trim();
      const reviewCount = $('meta[itemprop="reviewCount"]').attr('content');
      const imageUrl = $('img#coverImage').attr('src');

      const params = {
        title: bookTitle,
        author: authorName,
        rating: {
          average: avgRating,
          count: ratingCount
        },
        reviews: reviewCount,
        image: imageUrl
      };
      console.log(params);

      return params;
    })
    .catch(error => {
      console.log(error);
    });
}

module.exports = scrapeBookDetails;