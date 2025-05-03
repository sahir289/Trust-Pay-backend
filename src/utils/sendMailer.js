import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shadow77278837@gmail.com',
    pass: 'mowq yseg qlsb fjkv', // Use environment variable in production!
  },
});

/**
 * Send credentials email to user
 * @param {Object} param0
 * @param {string} param0.email - Recipient's email
 * @param {string} param0.username - Username to send
 * @param {string} param0.password - Password to send
 */
export const sendCredentialsEmail = async ({ email, username, password }) => {
  const subject = 'Your Login Credentials';
  const text = `Hello,\n\nYour account has been created.\nUsername: ${username}\nPassword: ${password}\n\nPlease log in and change your password.`;

  const html = `
    <p>Hello,</p>
    <p>Your account has been created.</p>
    <p><strong>Username:</strong> ${username}</p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Please log in and change your password.</p>
  `;

  const mailOptions = {
    from: '"TrustPay Admin" <shadow77278837@gmail.com>',
    to: email,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

export const sendOTP = async (email, otp, user_name, designation) => {
  const subject = 'Password Reset Request';
  const text = `Hello ${user_name},\n\nYou requested a password reset. Your OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.\n\nRequest Details:\n- User: ${user_name}\n- Designation: ${designation}\n\nIf you didn't request this, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Password Reset Request</h2>
      <p>Hello ${user_name},</p>
      <p>You requested a password reset. Here is your OTP:</p>
      <p style="font-size: 24px; font-weight: bold; color: #3498db;">${otp}</p>
      <p><em>This OTP is valid for 10 minutes. Do not share it with anyone.</em></p>
      <h4>Request Details:</h4>
      <ul>
        <li><strong>User:</strong> ${user_name}</li>
        <li><strong>Designation:</strong> ${designation}</li>
      </ul>
      <hr style="border: 1px solid #eee;">
      <p style="font-size: 12px; color: #7f8c8d;">
        If you didn't request this, please ignore this email or contact support immediately.
      </p>
    </div>
  `;

  const mailOptions = {
    from: '"TrustPay Admin" <shadow77278837@gmail.com>',
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