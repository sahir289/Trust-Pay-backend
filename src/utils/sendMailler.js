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
