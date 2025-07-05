
const nodemailer=require('nodemailer');


const sendEmail=async(options)=>{
    const transporter=nodemailer.createTransport({
        host:'smtp-relay.brevo.com',
        port:587,
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASS
        }
    })

 
    const mailOptions={
        from:`Ganesh Malo <malo.ganesh98@gmail.com>`,
        to:options.email,
        subject:options.subject,
        html:options.html,

    };
    await transporter.sendMail(mailOptions);

}

module.exports=sendEmail;