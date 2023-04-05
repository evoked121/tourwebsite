const express = require('express');
const tourController = require('./../controllers/tourController');
const authController = require('./../controllers/authController');
//const reviewController = require('./../controllers/reviewController');
reviewRouter = require('./../routes/reviewRoutes');

const router = express.Router();

//router.param('id', tourController.checkID);

//Create a checkBody middleware
//Check if body contains the name and price property

router.use('/:tourId/reviews', reviewRouter);

router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tour-stats').get(tourController.getTourStats);
/*
router.route(
  '/tours-within/:distance/center/:latlng/unit/:unit',
  tourController.getToursWithin
);*/
// /tours-distance/233/center/-40,45/unit/mi
router
  .route('/')
  .get(tourController.getAllTours)
  .post(authController.protect, tourController.createTour);
router
  .route('/:id')
  .get(authController.protect, tourController.getTour)
  .patch(authController.protect, tourController.updateTour)
  .delete(authController.protect, tourController.deleteTour);

module.exports = router;
