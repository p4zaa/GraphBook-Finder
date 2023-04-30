const axios = require('axios');
let params = {}

function fetchBookDetailsFromGoogleBooksAPI(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;

  return axios.get(url)
    .then(response => {
    const book = response.data.items !== undefined ? response.data.items[0] : null;
    if (book === null) {
      return params = {
        bookError: isbn,
        book: null
      }
    }
      const bookTitle = book.volumeInfo.title + ': ' + book.volumeInfo.subtitle;
      const authorNames = book.volumeInfo.authors;
      const authorName = authorNames ? authorNames.join('|') : '';
      const avgRating = book.volumeInfo.averageRating;
      const ratingCount = book.volumeInfo.ratingsCount;
      const reviewCount = book.volumeInfo.reviewsCount;
      const imageUrl = book.volumeInfo.imageLinks.thumbnail;
      const pageCount = book.volumeInfo.pageCount === 0 ? null : book.volumeInfo.pageCount;
      const genres = book.volumeInfo.categories ? book.volumeInfo.categories.join('|') : '';
      const publisher = book.volumeInfo.publisher;
      const publishedDate = book.volumeInfo.publishedDate;
      const description = book.volumeInfo.description;
      const language = book.volumeInfo.language;

      params = {
        bookError: null,
        book: {
          isbn: isbn,
          title: bookTitle,
          author: authorName,
          rating: {
            average: avgRating !== undefined ? avgRating : null,
            count: ratingCount !== undefined ? ratingCount : null
          },
          reviews: reviewCount !== undefined ? reviewCount : null,
          thumbnail: imageUrl,
          pageCount: pageCount,
          genres: genres,
          publisher: publisher,
          publishedDate: publishedDate,
          description: description,
          language: language
        }
      };

      //console.log(params);
      return params;
    })
    .catch(error => {
      console.log(error);
    });
}

module.exports = fetchBookDetailsFromGoogleBooksAPI;