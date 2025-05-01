// Firebase e Stripe
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnStn0Pqv-Ah7uIQkol_5mUJ510NBeQwg",
  authDomain: "ecommerce-edukhan.firebaseapp.com",
  projectId: "ecommerce-edukhan",
  storageBucket: "ecommerce-edukhan.firebasestorage.app",
  messagingSenderId: "67387576497",
  appId: "1:67387576497:web:cb4944f5915a3c466cd290"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence);
const stripe = Stripe('pk_test_51RHozMIbNjWChfAcxfffqvLcCuCJj52oQKx98V9wVyvcyFstgyLmGpvpLzcgSbEjXGKVBQoyYoRG7xmf26EX9GId00DPkXGBG5');

// Estado
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Elementos
const elements = {
  cartCount: document.getElementById('cart-count'),
  productGrid: document.querySelector('.product-grid'),
  authModal: document.getElementById('auth-modal'),
  authForm: document.getElementById('auth-form'),
  authError: document.getElementById('auth-error'),
  loadingOverlay: document.getElementById('loading-overlay')
};

// Carrinho
function updateCartCount() {
  elements.cartCount.textContent = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function renderCartItems() {
  const cartItems = document.getElementById('cart-items');
  if (!cartItems) return;

  cartItems.innerHTML = '';
  cart.forEach(item => {
    const price = parseFloat(item.price) || 0;
    const total = price * (item.quantity || 1);
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.innerHTML = `
      <img src="assets/img/PRODUTOS/${item.id}.png" alt="${item.name}" onerror="this.src='assets/img/placeholder.png'">
      <div class="item-info">
        <h3>${item.name}</h3>
        <p class="item-price">R$ ${price.toFixed(2).replace('.', ',')}</p>
        <div class="quantity-controls">
          <button class="quantity-btn" data-id="${item.id}" data-action="decrease">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" data-id="${item.id}" data-action="increase">+</button>
        </div>
        <button class="remove-btn" data-id="${item.id}">Remover</button>
      </div>
      <p class="item-total">R$ ${total.toFixed(2).replace('.', ',')}</p>
    `;
    cartItems.appendChild(itemElement);
  });

  updateCartSummary();
}

function updateQuantity(productId, change) {
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.quantity += change;
    if (item.quantity < 1) {
      removeItem(productId);
    } else {
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartCount();
      renderCartItems();
    }
  }
}

function removeItem(productId) {
  cart = cart.filter(item => item.id !== productId);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderCartItems();
}

function updateCartSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal > 100 ? 0 : 15;
  const total = subtotal + shipping;

  document.getElementById('subtotal')?.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  document.getElementById('shipping')?.textContent = `R$ ${shipping.toFixed(2).replace('.', ',')}`;
  document.getElementById('total')?.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// Autenticação
async function signUp(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      createdAt: new Date(),
      addresses: [],
      orders: [],
      cart: []
    });
    return userCredential.user;
  } catch (error) {
    console.error("Erro no cadastro:", error);
    throw error;
  }
}

async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Erro no login:", error);
    throw error;
  }
}

// Sincronizar carrinho
async function syncCartWithFirestore() {
  if (!currentUser) return;
  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const firestoreCart = userDoc.data()?.cart || [];
    const mergedCart = [...cart, ...firestoreCart].reduce((acc, item) => {
      const existing = acc.find(i => i.id === item.id);
      existing ? existing.quantity += item.quantity : acc.push(item);
      return acc;
    }, []);
    await updateDoc(doc(db, "users", currentUser.uid), { cart: mergedCart });
    localStorage.removeItem('cart');
    cart = mergedCart;
    updateCartCount();
    renderCartItems();
  } catch (error) {
    console.error('Erro ao sincronizar carrinho:', error);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.btn-add').forEach(button => {
    button.addEventListener('click', (e) => {
      const productCard = e.target.closest('.product-card');
      const priceText = productCard.querySelector('.price').textContent;
      const product = {
        id: e.target.dataset.product,
        name: productCard.querySelector('h3').textContent,
        price: parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'))
      };
      addToCart(product);
      alert('Produto adicionado ao carrinho!');
    });
  });

  updateCartCount();

  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      syncCartWithFirestore();
    }
  });
});

// Expor funções para HTML
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;
