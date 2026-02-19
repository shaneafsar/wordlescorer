// @ts-nocheck
import createError from "http-errors";
import * as express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import compression from "compression";
import logger from "morgan";
import { fileURLToPath } from 'url';
import indexRouter from "./routes/index.js";
import searchRouter from "./routes/search.js";
import dailyPostRouter from "./routes/daily-post.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

var app = express.default();
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(compression());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static'), { maxAge: '1d' }));
app.use('/', indexRouter);
app.use('/search', searchRouter);
app.use('/daily-post', dailyPostRouter);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});
// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
export default app;
