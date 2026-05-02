// 1. Import our installed tools
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// ==========================================
// EMAIL & SMS CONFIGURATION
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sauravjyotiswargiary10@gmail.com',      // Replace with your Gmail
        pass: 'iukemocwwlsfnvfm'    // Replace with your 16-digit App Password
    }
});

const accountSid = 'AC301cfe3cb2f45dbd1a79d719468bb7a8'; // Replace with Twilio SID
const authToken = '6fb7a9192da2acc3694efe5c1bfb0505';   // Replace with Twilio Auth Token
const twilioPhoneNumber = '+17628622377'; // Replace with Twilio Phone Number
const twilioClient = twilio(accountSid, authToken);

// Temporary storage for OTPs
const otpStorage = {};
// 2. Initialize the server
const app = express();
app.use(cors());
app.use(express.json()); // Allows server to understand form data from your HTML

// 3. Connect to XAMPP MySQL Database
// Database connection configuration
const db = mysql.createConnection({
    host: '127.0.0.1',     // <-- CHANGE THIS from 'localhost' to '127.0.0.1'
    user: 'root',          // Default XAMPP user
    password: '',          // Default XAMPP password is empty
    database: 'lms',       // Ensure this matches your actual database name
    port: 3306             // Explicitly state the port (optional, but good practice)
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        return;
    }
    console.log('Successfully connected to the MySQL Database!');
});

// 5. Start listening for requests

// --- API Endpoints will go here ---
// ==========================================
// BOOK MANAGEMENT API
// ==========================================

// 1. Route to ADD a new book (Receives data from frontend and saves to MySQL)
app.post('/api/books', (req, res) => {
    // Extract the data sent from the frontend form
    const { title, author, isbn, category, qty } = req.body;

    // The SQL query to insert the book into your database
    const sql = 'INSERT INTO books (isbn, title, author, category, quantity) VALUES (?, ?, ?, ?, ?)';
    
    // Execute the query
    db.query(sql, [isbn, title, author, category, qty], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to add book to the database' });
        }
        res.status(201).json({ message: 'Book successfully added to database!', id: result.insertId });
    });
});

// 2. Route to GET all books (Sends database data to the frontend table)
// 1. Route to GET all books (LOUD VERSION)
app.get('/api/books', (req, res) => {
    db.query('SELECT * FROM books', (err, results) => {
        if (err) {
            // This prints the exact MySQL error to your VS Code terminal
            console.error("❌ Database Error fetching books:", err.message); 
            return res.status(500).json({ error: 'Failed to fetch books' });
        }
        res.status(200).json(results);
    });
});

// 3. Route to DELETE a book
app.delete('/api/books/:isbn', (req, res) => {
    const bookIsbn = req.params.isbn;
    
    db.query('DELETE FROM books WHERE isbn = ?', [bookIsbn], (err, result) => {
        if (err) {
            console.error('Delete Error:', err);
            return res.status(500).json({ error: 'Failed to delete book. It might be tied to an active transaction.' });
        }
        res.status(200).json({ message: 'Book successfully deleted!' });
    });
});

// 4. Route to UPDATE a book
app.put('/api/books/:isbn', (req, res) => {
    const originalIsbn = req.params.isbn;
    const { title, author, isbn, category, qty } = req.body;

    const sql = 'UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, quantity = ? WHERE isbn = ?';
    
    db.query(sql, [title, author, isbn, category, qty, originalIsbn], (err, result) => {
        if (err) {
            console.error('Update Error:', err);
            return res.status(500).json({ error: 'Failed to update book. The new ISBN might already exist.' });
        }
        res.status(200).json({ message: 'Book successfully updated!' });
    });
});

// ==========================================
// MEMBER MANAGEMENT API
// ==========================================

// 1. Route to ADD a new member (Register)
// Route to ADD a new member (Register) WITH EMAIL & SMS
app.post('/api/users', (req, res) => {
    const { regNum, name, email, phone, dept } = req.body;
    const defaultPassword = phone; 

    const sql = 'INSERT INTO users (reg_number, name, email, phone, department, password) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.query(sql, [regNum, name, email, phone, dept, defaultPassword], (err, result) => {
        if (err) {
            console.error('Database Error:', err);
            return res.status(500).json({ error: 'Failed to register member. Email or Reg Number might already exist.' });
        }

        // --- NEW: SEND CONFIRMATION EMAIL ---
        const mailOptions = {
            from: 'YOUR_EMAIL@gmail.com', // MUST MATCH your Nodemailer config
            to: email,
            subject: 'Welcome to the Library Management System!',
            text: `Hello ${name},\n\nYou have been successfully registered.\nYour Registration ID is: ${regNum}\nYour temporary password is your phone number: ${phone}\n\nPlease log in and change your password.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("Email Error:", error);
            else console.log("Email sent: " + info.response);
        });

        // --- NEW: SEND CONFIRMATION SMS ---
        twilioClient.messages.create({
            body: `Welcome to the Library, ${name}! Your Login ID is ${regNum} and your password is your phone number.`,
            from: twilioPhoneNumber, // MUST MATCH your Twilio config
            to: phone 
        }).then(message => console.log("SMS Sent: ", message.sid))
          .catch(error => console.log("SMS Error:", error));

        res.status(201).json({ message: 'Member registered! Confirmation Email and SMS sent.' });
    });
});

// 2. Route to GET all members (View member list)
app.get('/api/users', (req, res) => {
    // We only want to pull 'members', not the 'admin' accounts
    const sql = 'SELECT * FROM users WHERE role = "member"';
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Database Error:', err);
            return res.status(500).json({ error: 'Failed to fetch members' });
        }
        res.status(200).json(results);
    });
});

// 3. Route to DELETE a member
app.delete('/api/users/:regNum', (req, res) => {
    const regNumber = req.params.regNum;
    
    db.query('DELETE FROM users WHERE reg_number = ?', [regNumber], (err, result) => {
        if (err) {
            console.error('Delete Error:', err);
            return res.status(500).json({ error: 'Failed to delete member. They might have unreturned books.' });
        }
        res.status(200).json({ message: 'Member successfully deleted!' });
    });
});

// 4. Route to UPDATE a member
app.put('/api/users/:regNum', (req, res) => {
    const originalRegNum = req.params.regNum;
    const { name, email, phone, dept } = req.body;

    const sql = 'UPDATE users SET name = ?, email = ?, phone = ?, department = ? WHERE reg_number = ?';
    
    db.query(sql, [name, email, phone, dept, originalRegNum], (err, result) => {
        if (err) {
            console.error('Update Error:', err);
            return res.status(500).json({ error: 'Failed to update member details.' });
        }
        res.status(200).json({ message: 'Member successfully updated!' });
    });
});

// ==========================================
// PASSWORD UPDATE API
// ==========================================

app.post('/api/change-password', (req, res) => {
    const { loginId, oldPassword, newPassword } = req.body;

    // 1. Verify that the user exists AND the old password is correct
    const verifySql = 'SELECT * FROM users WHERE (reg_number = ? OR email = ?) AND password = ?';
    
    db.query(verifySql, [loginId, loginId, oldPassword], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error while verifying user.' });
        }
        
        // 2. If a match is found, update the password!
        if (results.length > 0) {
            const updateSql = 'UPDATE users SET password = ? WHERE id = ?';
            
            db.query(updateSql, [newPassword, results[0].id], (err2) => {
                if (err2) {
                    console.error(err2);
                    return res.status(500).json({ error: 'Failed to update password in database.' });
                }
                res.status(200).json({ message: 'Password updated successfully!' });
            });
        } else {
            // No match found - wrong old password or wrong ID
            res.status(401).json({ error: 'Incorrect current password or User ID not found.' });
        }
    });
});

// ==========================================
// LOGIN & SIGNUP API 
// ==========================================

// 1. Route for New Members to Sign Up
app.post('/api/signup', (req, res) => {
    const { name, contact, password } = req.body;
    
    // Auto-generate a unique ID for the new member
    const regNum = 'LIB-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 1000); 

    // We save the 'contact' into the email field. Phone and Dept are marked 'Pending' so they can update them later.
    const sql = 'INSERT INTO users (reg_number, name, email, phone, department, password, role) VALUES (?, ?, ?, ?, ?, ?, "member")';
    
    db.query(sql, [regNum, name, contact, contact, 'Pending', password], (err, result) => {
        if (err) {
            console.error('Signup Error:', err);
            return res.status(500).json({ error: 'Account with this email might already exist.' });
        }
        res.status(201).json({ message: 'Account created successfully!', regNum: regNum });
    });
});

// Route to Generate and Send OTP via SMS
app.post('/api/send-otp', (req, res) => {
    const { contactId } = req.body; 

    if (!contactId) return res.status(400).json({ error: 'Please enter an ID or Email first.' });

    // Look up the user's phone number in the database
    db.query('SELECT phone FROM users WHERE reg_number = ? OR email = ?', [contactId, contactId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userPhone = results[0].phone;
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save OTP to temporary storage
        otpStorage[contactId] = generatedOtp;

        // Send OTP via Twilio SMS
        twilioClient.messages.create({
            body: `Your Library System Login OTP is: ${generatedOtp}. Do not share this code.`,
            from: twilioPhoneNumber,
            to: userPhone 
        }).then(message => {
            console.log("OTP SMS Sent successfully!");
            res.status(200).json({ message: 'OTP sent successfully to your registered phone number!' });
        }).catch(error => {
            console.error("Twilio SMS Error:", error);
            res.status(500).json({ error: 'Failed to send OTP SMS.' });
        });
    });
});

// Route for Admins and Members to Login (UPDATED WITH OTP LOGGING)
app.post('/api/login', (req, res) => {
    const { loginId, password, role, otp } = req.body;

    console.log("--- LOGIN ATTEMPT ---");
    console.log("User trying to log in:", loginId);
    console.log("OTP Stored in System:", otpStorage[loginId]);
    console.log("OTP Typed by User:", otp);

    // --- NEW: SAFE OTP VERIFICATION ---
    // We use String() to ensure we are comparing text to text
    if (!otpStorage[loginId] || String(otpStorage[loginId]) !== String(otp)) {
        console.log("❌ OTP Match Failed!");
        return res.status(401).json({ error: 'Invalid or Expired OTP. Please click Get OTP.' });
    }

    console.log("✅ OTP Matched Perfectly!");

    // Check if the user exists with matching credentials
   // Check if the user exists with matching credentials
    const sql = 'SELECT * FROM users WHERE (reg_number = ? OR email = ? OR phone = ?) AND password = ? AND role = ?';
    
    db.query(sql, [loginId, loginId, loginId, password, role], (err, results) => {
        if (err) {
            console.error('Login Error:', err);
            return res.status(500).json({ error: 'Database error during login.' });
        }

        if (results.length > 0) {
            console.log("✅ User found! Password matches. Sending success to frontend.");
            // Match found! Clear the OTP so it can't be reused
            delete otpStorage[loginId]; 
            res.status(200).json({ message: 'Login successful!', user: results[0] });
        } else {
            console.log("❌ Password Check Failed! The password typed did not match the database.");
            res.status(401).json({ error: 'Invalid Credentials or Role mismatch.' });
        }
    });
});

// ==========================================
// ISSUE & RETURN API
// ==========================================

// Route to ISSUE a book
app.post('/api/issue', (req, res) => {
    const { memberId, bookIsbn, issueDate, dueDate } = req.body;
    const transactionId = 'TRX-' + Math.floor(Math.random() * 100000); 

    // Step A: Check if the book exists and has quantity > 0
    db.query('SELECT quantity FROM books WHERE isbn = ?', [bookIsbn], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'Book not found in database.' });
        }
        
        if (results[0].quantity > 0) {
            // Step B: Record the transaction
            const sql = "INSERT INTO transactions (transaction_id, member_reg_number, book_isbn, action, transaction_date, due_date) VALUES (?, ?, ?, 'Issued', ?, ?)";
            
            db.query(sql, [transactionId, memberId, bookIsbn, issueDate, dueDate], (err2) => {
                if (err2) {
                    console.error('Issue Error:', err2);
                    return res.status(500).json({ error: 'Failed to issue book. Check Member ID and Book ISBN.' });
                }
                
                // Step C: Reduce the book quantity by 1
                db.query('UPDATE books SET quantity = quantity - 1 WHERE isbn = ?', [bookIsbn]);
                
                res.status(201).json({ message: 'Book successfully issued!', trxId: transactionId });
            });
        } else {
            res.status(400).json({ error: 'Book is currently out of stock!' });
        }
    });
});

// Route to RETURN a book
app.post('/api/return', (req, res) => {
    const { memberId, bookIsbn, returnDate, fine } = req.body;
    const transactionId = 'TRX-' + Math.floor(Math.random() * 100000);
    
    // Clean up the fine string (turn "$15" into the number 15.00)
    const fineAmount = parseFloat(fine.replace('$', '')) || 0.00;

    // Step A: Record the return transaction with the fine
    const sql = "INSERT INTO transactions (transaction_id, member_reg_number, book_isbn, action, transaction_date, fine_amount) VALUES (?, ?, ?, 'Returned', ?, ?)";
    
    db.query(sql, [transactionId, memberId, bookIsbn, returnDate, fineAmount], (err) => {
        if (err) {
            console.error('Return Error:', err);
            return res.status(500).json({ error: 'Failed to record return. Check Member ID and Book ISBN.' });
        }
        
        // Step B: Increase the book quantity by 1
        db.query('UPDATE books SET quantity = quantity + 1 WHERE isbn = ?', [bookIsbn]);
        
        res.status(201).json({ message: 'Book successfully returned!', trxId: transactionId });
    });
});

// Route to GET all transactions for the Reports Page
app.get('/api/transactions', (req, res) => {
    // We join the transactions table with the users and books tables so we can see actual names and titles instead of just IDs!
    const sql = `
        SELECT 
            t.transaction_id, 
            t.action, 
            t.transaction_date, 
            t.due_date, 
            t.fine_amount,
            u.name AS member_name, 
            b.title AS book_title
        FROM transactions t
        LEFT JOIN users u ON t.member_reg_number = u.reg_number
        LEFT JOIN books b ON t.book_isbn = b.isbn
        ORDER BY t.transaction_date DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Reports Error:', err);
            return res.status(500).json({ error: 'Failed to fetch transaction history.' });
        }
        res.status(200).json(results);
    });
});

// DELETE A BOOK
app.delete('/api/books/:isbn', (req, res) => {
    db.query('DELETE FROM books WHERE isbn = ?', [req.params.isbn], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete book.' });
        res.status(200).json({ message: 'Book successfully deleted!' });
    });
});

// DELETE A MEMBER
app.delete('/api/users/:regNum', (req, res) => {
    db.query('DELETE FROM users WHERE reg_number = ?', [req.params.regNum], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete member.' });
        res.status(200).json({ message: 'Member successfully deleted!' });
    });
});

// ==========================================
// DASHBOARD STATISTICS API (LOUD VERSION)
// ==========================================
app.get('/api/dashboard-stats', (req, res) => {
    const stats = { totalBooks: 0, totalUsers: 0, borrowedBooks: 0, totalFines: 0 };

    db.query('SELECT COUNT(*) AS count FROM books', (err1, results1) => {
        if (err1) console.error("❌ Books Stat Error:", err1.message);
        else stats.totalBooks = results1[0].count;

        db.query('SELECT COUNT(*) AS count FROM users WHERE role = "member"', (err2, results2) => {
            if (err2) console.error("❌ Users Stat Error:", err2.message);
            else stats.totalUsers = results2[0].count;

            db.query('SELECT COUNT(*) AS count FROM transactions WHERE action = "Issued"', (err3, results3) => {
                if (err3) console.error("❌ Transactions Stat Error:", err3.message);
                else stats.borrowedBooks = results3[0].count;

                db.query('SELECT SUM(fine_amount) AS total FROM transactions', (err4, results4) => {
                    if (err4) console.error("❌ Fines Stat Error:", err4.message);
                    else stats.totalFines = results4[0].total || 0;

                    // Log the final numbers to your VS Code terminal!
                    console.log("📊 Sending stats to frontend:", stats);
                    res.status(200).json(stats);
                });
            });
        });
    });
});

// Route to GET borrowed books for a SPECIFIC member
app.get('/api/my-books/:regNum', (req, res) => {
    const regNum = req.params.regNum;
    
    // Join transactions with books so we get the Book Title instead of just the ISBN
    const sql = `
        SELECT t.transaction_id, t.action, t.transaction_date, t.due_date, t.fine_amount, b.title, b.author
        FROM transactions t
        JOIN books b ON t.book_isbn = b.isbn
        WHERE t.member_reg_number = ?
        ORDER BY t.transaction_date DESC
    `;
    
    db.query(sql, [regNum], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.status(200).json(results);
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});