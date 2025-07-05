const catchAsync = require("../utils/catchAsync");
const User =require('../model/userModel');
const generateOtp = require("../utils/generateOtp");
const jwt=require('jsonwebtoken');
const sendEmail = require("../utils/email");
const AppError = require("../utils/AppError");
const comparePassword=require("../model/userModel");
const AuditLog = require('../model/AuditLog');

const signToken=(id)=>{
    return jwt.sign({id},process.env.JWT_SECRET,{
        expiresIn:process.env.JWT_EXPIRES_IN
    })
}


const createSendToken=(user,statusCode,res,message)=>{
const token=signToken(user._id);

const cookieOptions={
    expire:new Date(Date.now()+process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
    httpOnly:true,
    secure:process.env.NODE_ENV==='production', //secure only in production
    sameSite:process.env.NODE_ENV==='production'?'none':'Lax'
};
res.cookie("token",token,cookieOptions);

user.password=undefined;
user.passwordConfirm=undefined;
user.otp=undefined;
res.status(statusCode).json({
    status:'success',
    message,
    token,
    data:{
        user,
    }
})


}


/** signup function **/

exports.signup=catchAsync(async(req,res,next)=>{
    const {email,password,passwordConfirm,username}=req.body;
    if(password.length<8){
        return next(new AppError('Password should be more than 8',400));
    }
    if(password.length!==passwordConfirm.length){
        return next(new AppError('Please verify the confirm password',400));
    }
    if(password!==passwordConfirm){
       return next(new AppError('Password is not matching',400)); 
    }
    const existingUser=await User.findOne({email});
    if(existingUser){
        if(!existingUser.isVerified){
           return next(new AppError('Email is not verified',400)); 
        }
        return next(new AppError('Email already registered',400));
    }
    const otp=generateOtp();


    const otpExpires=Date.now()+5*60*1000;

    const newUser =await User.create({
        username,
        email,
        password,
        passwordConfirm,
        otp,
        otpExpires
    });
    

    try{
    await sendEmail({
        email:newUser.email,
        subject:'OTP for email verification',
        html:`<h1>Your OTP is :${otp}`

    })
    createSendToken(newUser,200,res,"Registration successful");

    }catch(error){
     await User.findByIdAndDelete(newUser.id);
     return next(new AppError("There is an error while sending email, Please try again",500));
    }

})

/***Verify email function***/

exports.verifyAccounts=catchAsync(async(req,res,next)=>{
   const {otp}=req.body;
   if(!otp){
   return  new next(AppError("OTP is missing",400));
   }
   const user=req.user;
   console.log("user.otp:"+otp);
   if(user.otp!==otp){
    return next(new AppError("invalid OTP",400));
   }
   if(Date.now()>user.otpExpires){
    return next(new AppError("OTP has expired",400));
   }
   user.isVerified=true;
   user.otp=undefined;
   user.otpExpires=undefined;
   await user.save({validateBeforeSave:false});
   createSendToken(user,200,res,"Email has been verified");
})





/***login function***/

exports.login=catchAsync(async(req,res,next)=>{
    
const {email,password}=req.body;
const existingUser = await User.findOne({ email }).select('+password +username');

console.log("backend ",existingUser);

if(!email || !password)
    return next(new AppError("Email and password is missing",400));

if(!existingUser){
    return next(new AppError("Please create an account before login",400));
}
if(!existingUser.isVerified && existingUser.otpExpires>Date.now()){
    return next(new AppError("Email not verified ",400));
}

  if (!(await existingUser.comparePassword(password, existingUser.password))) {
    return next(new AppError("Incorrect email and password", 401));
}


createSendToken(existingUser, 200, res, "Login successful");



})



/***resend OTP function***/

exports.resendOTP=catchAsync(async(req,res,next)=>{

    const {email}=req.user;
 
  

    if(!email){
        return next(new AppError("Please enter email",400))
    }
    const user=await User.findOne({email});
    if(!user){
      return next(new AppError("User not found",404))
    }
    if(user.isVerified)
    return next(new AppError('Account already vrified',404));
    const newOtp=generateOtp();
    user.otp=newOtp;
    user.otpExpires=Date.now()+5*60*1000;
    await user.save({validateBeforeSave:false});
    try{
        await sendEmail({
            email:user.email,
            subject:"Resend otp for email verification",
            html:`<h1>Your new otp is : ${newOtp}</h1>`
        })
        res.status(200).json({
            status:"success",
            message:"new otp sent to your email"
        })

    }catch(err){
        user.otp=undefined;
        user.otpExpires=undefined;
        await user.save({validateBeforeSave:false});
        return next(new AppError("There is an error while sending the email ! Please try again!!!",500));
    }

})


/***logout function***/

exports.logout=catchAsync(async(req,res,next)=>{
res.cookie("token",{
    expires:new Date(Date.now()+10*1000),
    httpOnly:true,
    secure:process.env.NODE_ENV==="production"
})
res.status(200).json({
    status:"success",
    message:"Logout successfully"
})
})


/***forgot password function***/

exports.forgetPassword=catchAsync(async(req,res,next)=>{
const {email}=req.body;
if(!email){
    return next(new AppError("Please enter email",400));
}
const existingUser=await User.findOne({email});
if(!existingUser){
    return next(new AppError("User not found please create an account",404));  
}
const otp=generateOtp();
 existingUser.resetPasswordOtp=otp;
existingUser.resetPasswordOTPExpires=Date.now()+5*60*1000;
await existingUser.save({validateBeforeSave:false});
try{
    await sendEmail({
        email:existingUser.email,
        subject:"Your password reset otp (valid for 5 min)",
        html:`<h1>Your password reset OTP : ${otp}</h1>`
    })
    const resetToken = jwt.sign({ email: existingUser.email }, process.env.JWT_SECRET, { 
    expiresIn: '10m' // valid for 10 minutes
});


  res.status(200).json({
    status:"success",
    message:"Password rset otp has been sent to your email",
    resetToken
  }) 
 
}catch(error){
 existingUser.resetPasswordOtp=undefined;
 existingUser.resetPasswordOTPExpires=undefined;
 await existingUser.save({validateBeforeSave:false});
 return next(new AppError("There is an error while sending the email. Please try again later",400));

}
})

/***reset password function***/

exports.resetPassword=catchAsync(async(req,res,next)=>{
    

    const {resetToken,otp,password,passwordConfirm}=req.body;
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        const email = decoded.email;
    
    const existingUser=await User.findOne({email});
    
    if(existingUser.resetPasswordOTPExpires>Date.now()){
    if(existingUser.resetPasswordOtp!==otp){
       return next(new AppError("Password reset otp is not matching",400));   
    }
    }
    else
     return next(new AppError("Password reset OTP has expired",400)); 

    if(!existingUser){
      return next(new AppError("User not found",400));  
    }
    existingUser.password=password;
    existingUser.passwordConfirm=passwordConfirm;
    existingUser.resetPasswordOtp=undefined;
    existingUser.resetPasswordOTPExpires=undefined;

    await existingUser.save();

    createSendToken(existingUser,200,res,"Password reset Successfully");


})




/*Clean up process*/
// routes/userRoutes.js or routes/utilityRoutes.js



    exports.cleanupUnverifiedEmail=catchAsync(async (req, res) => {
    try {
    // Find users to delete
    const usersToDelete = await User.find({
      isVerified: false,
      otpExpires: { $lt: Date.now() }
    });

    if (usersToDelete.length === 0) {
      return res.status(200).json({ status: 'success', message: 'No users to clean' });
    }

    // Create audit logs before deleting
    const logs = usersToDelete.map(user => ({
      action: 'delete_user',
      userId: user._id.toString(),
      email: user.email,
      reason: 'unverified_and_otp_expired',
      performedBy: 'system'
    }));

    await AuditLog.insertMany(logs);

    // Delete users
    await User.deleteMany({ _id: { $in: usersToDelete.map(u => u._id) } });

    res.status(200).json({
      status: 'success',
      message: 'Unverified users cleaned and logged',
      deletedCount: usersToDelete.length
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


//   try {
//     const result = await User.deleteMany({
//       isVerified: false,
//       otpExpires: { $lt: Date.now() }
//     });

//     res.status(200).json({
//       status: 'success',
//       deleted: result.deletedCount,
//       message: 'Unverified users cleaned up',
//     });
//   } catch (err) {
//     res.status(500).json({ status: 'error', message: err.message });
//   }
// });


