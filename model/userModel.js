const mongoose=require('mongoose');
const validator=require('validator');
const bcrypt=require('bcryptjs')


const userSchema=new mongoose.Schema({
    username:{
        type:String,
        required:[true,"Please provide username"],
        minlength:3,
        maxlength:30,
        index:true
    },
    email:{
        type:String,
        required:[true,"Please provide an email"],
        unique:true,
        lowercase:true,
        validate:[validator.isEmail,"Please provide a valid email"],

    },
    password:{
        type:String,
        required:[true,"Please provide a valid password"],
        minlength:8,
        select:false,

    },
   passwordConfirm: {
  type: String,
  required: [true, "Please confirm your password"],
  validate: {
    validator: function (el) {
      return el === this.password;
    },
    message: "Passwords do not match",
  },
  select: false // Prevent selection from DB
},

    isVerified:{
        type:Boolean,
        default:false
    },
    otp:{
        type:String,
        default:null,

    },
    otpExpires:{
        type:Date,
        default:null
    },
    resetPasswordOtp:{
        type:String,
        default:null,
    },
    resetPasswordOTPExpires:{
        type:Date,
        default:null
    },
    createdAt:{
        type:Date,
        default:Date.now
    }

},{
    timestamps:true
})


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm=undefined;
  next();
});

/****function to compare password****/
userSchema.methods.comparePassword=async(password,dbStorePassword)=>{
    
    return await bcrypt.compare(password,dbStorePassword);
}


const User=mongoose.model("User",userSchema);
module.exports=User;


