import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import movieInfo from 'movie-info';

const app = express();
const port = 3000;
const { Client } = pg;
const client = new Client({
    user: 'postgres',
    password: 'Boom10161',
    host: 'localhost',
    port: 5432,
    database: 'Movies'
});

await client.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

console.log('----------------------------')
// movieInfo('Blade Runner 2049').then(console.log)
// const imageUrl = movieInfo('Avatar')
//   .then(response => console.log(response.imageBase + response.poster_path))
let infoTable;


// console.log(infoTable)
app.get('/', async (req, res) =>{
    console.log('----------------------------')
    // joining users, movies, reviews table
    infoTable = await client.query('SELECT users.username, movies.title, movies.releasedate, movies.overview, movies.posterurl, reviews.id, reviews.rating, reviews.review, reviews.reviewdate FROM reviews INNER JOIN users ON users.id = reviews.user_id INNER JOIN movies ON movies.id = reviews.movie_id ORDER BY reviews.reviewdate')
    // console.log('This is the info table: ' )
    

    let addDates = async () =>{
        let infoArr = infoTable.rows;
        infoArr.forEach(infoItem =>{
            console.log(infoItem)
            let releaseDate = infoItem['releasedate'];
            let reviewDate = infoItem['reviewdate'];

            releaseDate = (releaseDate.toString()).slice(0,10);
            reviewDate = (reviewDate.toString()).slice(0,10);
            
            infoItem.releasedate = releaseDate;
            infoItem.reviewdate = reviewDate;
        })
        
    }
    await addDates();


    
    // console.log(infoTable.rows)
    try { 
      res.render('index.ejs', {reviews: infoTable.rows});
    } catch (error) {
        console.error('Error with homepage: ', error);
    }
})

app.post('/add', async (req, res) =>{
    try {
        console.log('----------------------------------------')
        // console.log(req.body);
        let {username ,movieTitle, movieReviewDate, movieRating, movieReview} = req.body;
        // console.log('this is after destructuring', movieTitle, movieReviewDate, movieRating, movieReview)
        let movieOverview, moviePoster, movieReleaseDate, userId, movieId;
        movieReviewDate = movieReviewDate.slice(0, 10)

        // fetching movie info
        try{
            await movieInfo(movieTitle, (err, res) =>{
                movieOverview = res.overview;
                moviePoster = res.imageBase + res.poster_path;
                movieReleaseDate = (res.release_date).slice(0, 10);
            });
        } catch(error){
            console.error('Error with fetching movie info: ', error);
        }
        
        // console.log('This review and release date: ', movieReviewDate, movieReleaseDate)

        // adding date to database
        try {
            // adding info about user into the users table
            await client.query('INSERT INTO users(username) VALUES($1)', [username])
                    
            // adding info about the movie being reviewed into the movies table
            await client.query('INSERT INTO movies(title, releaseDate, overview, posterURL) VALUES($1, $2, $3, $4)', [movieTitle, movieReleaseDate, movieOverview, moviePoster]);

            // fetching userid and movie id from their tables to add to reviews table as foreign key
            userId = await client.query('SELECT id FROM users WHERE username = $1', [username]);
            movieId = await client.query('SELECT id FROM movies WHERE title = $1', [movieTitle]);
            // console.log('this is user and movie id: ',userId, movieId)
    
            // adding data to the reviews table    
            await client.query('INSERT INTO reviews(rating, review, reviewDate, user_id, movie_id) VALUES($1, $2, $3, $4, $5)', [movieRating, movieReview, movieReviewDate, userId.rows[0].id, movieId.rows[0].id])
            
        } catch (error) {
            console.error('Error with adding data to database: ', error);
        }

        // console.log(moviePoster, movieOverview, movieReleaseDate)
        res.redirect('/')
    } catch (error) {
        console.error('Error with adding review: ', error);
    }
});

app.post('/edit', async (req, res) =>{
    try {
        console.log(req.body);
        const {reviewId, movieRating, movieReview} = req.body;

        await client.query('UPDATE reviews SET rating = $1, review = $2 WHERE id = $3', [movieRating, movieReview, reviewId])
    } catch (error) {
        console.error('Error with editing review: ', error);
    }
    


    res.redirect('/')
})

app.post('/delete', async (req, res) =>{
    try {
        console.log(req.body)
        const {reviewId} = req.body

        const SQLQuery = `
                DELETE FROM rev
        `;

        const response = await client.query('SELECT user_id, movie_id FROM reviews WHERE id = $1', [reviewId])  
        const { user_id, movie_id } = response.rows[0] 
        await client.query('DELETE FROM reviews WHERE id = $1 RETURNING user_id, movie_id', [reviewId])
        console.log(user_id, movie_id)
        //deleting info from users table
        await client.query('DELETE FROM users WHERE id = $1', [user_id])

        //deleting info from movies table
        await client.query('DELETE FROM movies WHERE id = $1', [movie_id])

    } catch (error) {
        console.error('Error with deleting review: ', error);
    }
    
    res.redirect('/')
})

app.listen(port, () =>{
    console.log(`Running on port: ${port}`);
});
