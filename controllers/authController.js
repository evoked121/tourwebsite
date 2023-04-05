const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const token = signToken(newUser._id);

  res.status(201).json({
    status: 'success',
    token,
    data: {
      newUser,
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //1) check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  //2) user exists and password correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //3) If everything ok, send token
  const token = signToken(user._id);
  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  //1) getting token and check if exits
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in', 401));
  }
  /*
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //3)Check if user still exists
  const freshUser = await User.findById(decoded.id);

  if (!freshUser) {
    return next(new AppError('User not exist', 401));
  }

  //4)check if user changed password after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('recently changed password', 401));
  }
  req.user = freshUser;*/
  next();
});

//authorization
/*
exports.restrictTo = (...roles) => {
  return async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('donnot have permission', 403));
    }
    next();
  };
};*/
exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1) get user based on email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There isno user with the email', 404));
  }
  //2)generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //3) send email
  const resetURL = `${req.protocal}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;
  const message = `Forgot password? submit a patch request with a new password to ${resetURL}.`;

  try {
    await sendEmail({
      email: req.body.email,
      subject: 'Your password reset token',
      message,
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('There was an error sending email', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  //2)if token not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1) get user from collection
  const user = await User.findById(req.user.id).select('+password');

  //2) check if current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('current password is wrong', 401));
  }
  //3 if so, update
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4 log user in, send JWT
  createSendToken(user, 200, res);
});
