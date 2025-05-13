import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  //added required mail
  host: 'smtp.zoho.com',
  port: 465,
  secure: true, 
  auth: {
    user: 'support@trustpays24.com',
    pass: 'aBSs KhuS niTX',
  },
});

/**
 * Send credentials email to user
 * @param {Object} param0
 * @param {string} param0.email - Recipient's email
 * @param {string} param0.username - Username to send
 * @param {string} param0.password - Password to send
 */
//environment based redirection
let redirectingUrl ;
if (process.env.NODE_ENV === 'production') {
  redirectingUrl  = "https://trustpays24.com/"
}
else if (process.env.NODE_ENV === 'staging'){
  redirectingUrl = "https://staging.trustpays24.com/"
}
//format the UI of mail
export const sendCredentialsEmail = async ({ email, username, password }) => {
  const subject = 'Your Account Credentials';
  const text = `Hello,\n\nYour account has been created successfully.\n\nUsername: ${username}\nPassword: ${password}\n\nPlease log in and change your password immediately for security.\n\nBest regards,\nPG Admin Team`;

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9fafb;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://via.placeholder.com/150x50?text=TrustPays" alt="TrustPays Logo" style="height: 50px;">
    </div>
    <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <p style="font-size: 16px; color: #2d3748;">Hello, Greetings of the day,</p>
      <h2 style="font-size: 22px; color: #1a202c;">Welcome to TrustPays – a fast, secure, and reliable Payment Gateway.</h2>
      <p style="font-size: 15px; color: #4a5568;">You can sign in to your TrustPays account using the credentials below:</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin-top: 16px;">
        <p style="margin: 8px 0; color: #2d3748;"><strong>Login URL:</strong> <a href="${redirectingUrl}" style="color: #3182ce;">${redirectingUrl}</a></p>
        <p style="margin: 8px 0; color: #2d3748;"><strong>Username:</strong> ${username}</p>
        <p style="margin: 8px 0; color: #2d3748;"><strong>Password:</strong> ${password}</p>
      </div>
      <p style="font-size: 14px; color: #718096; margin-top: 20px;">Please log in and change your password immediately for security.</p>
      <p style="font-size: 14px; color: #718096;">Thank you,<br>TrustPay Team</p>
    </div>
    <p style="text-align: center; font-size: 12px; color: #a0aec0; margin-top: 20px;">&copy; ${new Date().getFullYear()} TrustPays. All rights reserved.</p>
  </div>
`;


  const mailOptions = {
    from: '"PG Admin" <support@trustpays24.com>',
    to: email,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

export const sendOTP = async (email, otp, user_name, designation) => {
  const subject = 'Password Reset OTP';
  const text = `Hello ${user_name},\n\nYou have requested a password reset. Your OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.\n\nRequest Details:\n- User: ${user_name}\n- Designation: ${designation}\n\nIf you didn't request this, please contact support@pgadmin.com.\n\nBest regards,\nTrustPay Admin Team`;
//format UI of Mail
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fa;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://via.placeholder.com/150x50?text=TrustPay+Logo" alt="TrustPay Logo" style="max-width: 150px;">
      </div>
      <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1a202c; font-size: 24px; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">Hello ${user_name},</p>
        <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">You have requested a password reset. Your one-time password (OTP) is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 28px; font-weight: bold; color: #3182ce; letter-spacing: 4px; background-color: #edf2f7; padding: 10px 20px; border-radius: 6px;">${otp}</span>
        </div>
        <p style="color: #4a5568; font-style: italic; margin-bottom: 20px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        <h4 style="color: #2d3748; font-size: 16px; margin-bottom: 10px;">Request Details:</h4>
        <ul style="color: #4a5568; line-height: 1.6; margin-bottom: 20px; padding-left: 20px;">
          <li><strong>User:</strong> ${user_name}</li>
          <li><strong>Designation:</strong> ${designation}</li>
        </ul>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px; text-align: center;">
          If you didn’t request this, please <a href="mailto:support@pgadmin.com" style="color: #3182ce; text-decoration: none;">contact support</a> immediately.
        </p>
      </div>
      <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 20px;">&copy; ${new Date().getFullYear()} TrustPay Admin. All rights reserved.</p>
    </div>
  `;

  const mailOptions = {
    from: '"TrustPay Admin" <support@trustpays24.com>',
    to: email,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('Failed to send OTP:', error.message);
    throw new Error('Failed to send OTP. Please try again later.');
  }
};