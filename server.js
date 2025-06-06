const express = require("express");
require("dotenv").config();
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs"); 
const { getFirestore, collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, Timestampimestamp } = require("firebase/firestore")
const app = express();
app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert("./njeforbi-ims-firebase-adminsdk-fbsvc-b51e519fa7.json"),
  projectId: "njeforbi-ims",
});

const db = admin.firestore();
const userCollection = db.collection("users");
const productsRef = db.collection("products");

app.post("/create-user", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role ) {
      return res.status(400).json({ error: "Fill in the required fields" });
    }

   
    const hashedPassword = await bcrypt.hash(password, 10);

   
    const newUserRef = await userCollection.add({
      name,
      email,
      password: hashedPassword,
      role
    });

    const newUser = { id: newUserRef.id, name, email, role };

 
    const accessToken = jwt.sign(newUser, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });

    res.json({ msg: "User added", user: newUser, token: accessToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-product", async (req, res) => {
  try {
    const { name, quantity, price, barcode, expiryDate, imageUrl, category } = req.body;
    if (!name || !quantity || !price || !barcode || !expiryDate || !imageUrl || !category) {
      return res.status(400).json({ error: "Fill in the required fields" });
    }
    const [day, month, year] = expiryDate.split("-");
    const parsedExpiryDate = new Date(`${year}-${month}-${day}`);

    if (isNaN(parsedExpiryDate.getTime())) {
      return res.status(400).json({ error: "Invalid expiryDate format. Use DD-MM-YYYY." });
    }

    
    

    const generateSKU = async (name) => {
      const namePrefix = name.substring(0, 3).toUpperCase();
      const productsRef = db.collection("products");
      const productsMade = await productsRef.get();
      const ProductCount = productsMade.size + 1;
      return `${namePrefix}-${ProductCount.toString().padStart(3, "0")}`;
    };

    const sku = await generateSKU(name);  
    const stockState = "IN";    
    const productData = {
      name,
      sku,
      quantity,
      price,
      barcode,
      stockState,
      category,
      expiryDate,
      imageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
   
  
    const productRef = await db.collection("products").add(productData);

    res.status(201).json({ message: "Product created successfully", productId: productRef.id, sku, stockState });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/products", async (req, res) => {
  try {
    const querySnapshot = await await productsRef.get();
    const products = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/update-product/:id", async (req, res) => {
  try {
    const { id } = req.params; 
    console.log("Product ID to Update:", id);  
    
    const { name, quantity, price, barcode, expiryDate, imageUrl, category } = req.body;

    
    if (!name || !quantity || !price || !barcode || !expiryDate || !imageUrl || !category) {
      return res.status(400).json({ error: "Fill in the required fields" });
    }

    
    if (typeof expiryDate !== "string" || !expiryDate.includes("-")) {
      return res.status(400).json({ error: "Invalid expiryDate format. Use DD-MM-YYYY." });
    }

    const [day, month, year] = expiryDate.split("-");
    const parsedExpiryDate = new Date(`${year}-${month}-${day}`);

    if (isNaN(parsedExpiryDate.getTime())) {
      return res.status(400).json({ error: "Invalid expiryDate format. Use DD-MM-YYYY." });
    }

    
    const productRef = db.collection("products").doc(id); 
    const productDoc = await productRef.get();

    console.log("Product Found:", productDoc.exists ? "Found" : "Not Found");

    if (!productDoc.exists) {
      return res.status(404).json({ error: "Product not found" });
    }

 
    await productRef.update({
      name,
      quantity,
      price,
      barcode,
      category,
      expiryDate: parsedExpiryDate, 
      imageUrl,
      updatedAt: new Date(),  
    });

    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/delete-product/:sku", async (req, res) => {
  try {
    const { sku } = req.params; 
    console.log("🔍 Searching for product with SKU:", sku);

  
    const productSnap = await db.collection("products").where("sku", "==", sku).get();

   
    if (productSnap.empty) {
      console.log("❌ Product not found!");
      return res.status(404).json({ error: "Product not found with the given SKU" });
    }

   
    const productDoc = productSnap.docs[0];
    await productDoc.ref.delete();

    console.log("✅ Product deleted successfully:", productDoc.id);
    res.status(200).json({ message: "Product deleted successfully" });

  } catch (error) {
    console.error("🔥 Error deleting product:", error.message);
    res.status(500).json({ error: error.message });
  }
});




app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

   
    const snapshot = await userCollection.where("email", "==", email).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    if (!user.role) {
      return res.status(400).json({ error: "User role not found in database" });
    }

  
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

   
    console.log(` Logged in as: ${user.role}`);

    const payload = { id: userDoc.id, name: user.name, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });

    res.json({ msg: "Login successful", token: accessToken, role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-category", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });

    const categoryRef = await db.collection("categories").add({
      name,
      description: description || "",
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Category created successfully", categoryId: categoryRef.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const querySnapshot = await db.collection("categories").get();
    const categories = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/category/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const categoryDoc = await db.collection("categories").doc(id).get();

    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json({ id: categoryDoc.id, ...categoryDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/update-category/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const categoryRef = db.collection("categories").doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Category not found" });
    }

    await categoryRef.update({
      name: name || categoryDoc.data().name,
      description: description || categoryDoc.data().description,
      updatedAt: new Date(),
    });

    res.status(200).json({ message: "Category updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/delete-category/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const categoryRef = db.collection("categories").doc(id);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Category not found" });
    }

    await categoryRef.delete();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get("/category-by-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const categoryDoc = await db.collection("categories").doc(id).get();

    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json({ id: categoryDoc.id, ...categoryDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/stock-motion/:id", async (req, res) => {
  try {
    const { id } = req.params; 
    console.log("Product ID to Update stock state:", id);  
    
    const { stockState } = req.body;

    const productRef = db.collection("products").doc(id); 
    const productDoc = await productRef.get();

    console.log("Product Found:", productDoc.exists ? "Found" : "Not Found");

    if (!productDoc.exists) {
      return res.status(404).json({ error: "Product not found" });
    }

 
    await productRef.update({
      
      stockState,
      updatedAt: new Date(),  
    });

    res.status(200).json({ message: "stock updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-sales-order", async (req, res) => {
  try {
    const { customerId, items } = req.body; // items = [{ sku, quantity }]
    if (!customerId || !items.length) {
      return res.status(400).json({ error: "Customer and items are required" });
    }

    const batch = db.batch();
    const productsForTransaction = [];
    let totalAmount = 0;

    for (const item of items) {
      // Find product by SKU
      const productSnap = await db.collection("products").where("sku", "==", item.sku).limit(1).get();
      if (productSnap.empty) {
        return res.status(404).json({ error: `Product with SKU ${item.sku} not found` });
      }

      const productDoc = productSnap.docs[0];
      const productData = productDoc.data();

      if (productData.quantity < item.quantity) {
        return res.status(400).json({ error: `Not enough stock for ${item.sku}` });
      }

      const newQuantity = productData.quantity - item.quantity;

      // Determine stock state
      let stockState = "In Stock";
      if (newQuantity === 0) stockState = "Out of Stock";
      else if (newQuantity < 5) stockState = "Low Stock";

      // Update product in batch
      batch.update(productDoc.ref, {
        quantity: newQuantity,
        stockState,
      });

      // Add to transaction log
      productsForTransaction.push({
        productId: productDoc.id,
        sku: item.sku,
        quantity: item.quantity,
        name: productData.name || "",
        unitPrice: productData.price || 0,
      });

      totalAmount += (productData.price || 0) * item.quantity;
    }

    // Save sales order
    const orderRef = db.collection("sales_orders").doc();
    batch.set(orderRef, {
      customerId,
      items,
      totalAmount,
      createdAt: new Date(),
    });

    await batch.commit();

    // Save transaction
    await db.collection("transactions").add({
      type: "sales_order",
      reference: orderRef.id,
      products: productsForTransaction,
      totalAmount,
      createdBy: req.user?.uid || null,
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Order placed successfully", orderId: orderRef.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


app.post("/receive-purchase-order/:poId", async (req, res) => {
  try {
    const { poId } = req.params;
    const poDoc = await db.collection("purchase_orders").doc(poId).get();
    if (!poDoc.exists) return res.status(404).json({ error: "PO not found" });

    const po = poDoc.data();
    const batch = db.batch();

    for (const item of po.items) {
      const productSnap = await db.collection("products").where("sku","==", item.sku).get();
      if (productSnap.empty) continue;
      const productRef = productSnap.docs[0].ref;

      // Update stock
      const newQty = (productSnap.docs[0].data().quantity || 0) + item.quantity;
      batch.update(productRef, { quantity: newQty, updatedAt: new Date() });

      // Log stock movement
      const smRef = db.collection("stock_movements").doc();
      batch.set(smRef, {
        sku: item.sku,
        change: item.quantity,
        type: "purchase",
        timestamp: new Date(),
      });
    }

    // Update PO status
    const poRef = db.collection("purchase_orders").doc(poId);
    batch.update(poRef, { status: "Received", updatedAt: new Date() });

    await batch.commit();
    res.json({ message: "Purchase order received and stock updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/purchase-orders", async (req, res) => {
  try {
    const snapshot = await db.collection("purchase_orders").get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/purchase-order/:poId", async (req, res) => {
  try {
    const { poId } = req.params;
    const docRef = db.collection("purchase_orders").doc(poId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    res.status(200).json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/purchase-order/:poId", async (req, res) => {
  try {
    const { poId } = req.params;
    const updates = req.body; // e.g., { status: "Canceled" } or updated items
    const docRef = db.collection("purchase_orders").doc(poId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    updates.updatedAt = new Date();
    await docRef.update(updates);
    res.status(200).json({ message: "Purchase order updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/delete-purchase/:poId", async (req, res) => {
  try {
    const { poId } = req.params;
    const docRef = db.collection("purchase_orders").doc(poId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    await docRef.delete();
    res.status(200).json({ message: "Purchase order deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/transactions-history", async (req, res) => {
  try {
    const snapshot = await db.collection("transactions").orderBy("createdAt", "desc").get();
    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});





const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
