// Configuração Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCnStn0Pqv-Ah7uIQkol_5mUJ510NBeQwg",
    authDomain: "ecommerce-edukhan.firebaseapp.com",
    projectId: "ecommerce-edukhan",
    storageBucket: "ecommerce-edukhan.firebasestorage.app",
    messagingSenderId: "67387576497",
    appId: "1:67387576497:web:cb4944f5915a3c466cd290"
  };
  
  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // Configuração Stripe
  const stripe = Stripe('pk_test_51RHozMIbNjWChfAcxfffqvLcCuCJj52oQKx98V9wVyvcyFstgyLmGpvpLzcgSbEjXGKVBQoyYoRG7xmf26EX9GId00DPkXGBG5');
  
  // Estado da aplicação
  let currentUser = null;
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  // Elementos da UI
  const elements = {
    cartCount: document.getElementById('cart-count'),
    productGrid: document.querySelector('.product-grid')
  };
  
  // Funções do Carrinho
  function updateCartCount() {
    elements.cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
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
      // Validação do preço
      const price = parseFloat(item.price) || 0;
      const total = price * (item.quantity || 1);
      
      const itemElement = document.createElement('div');
      itemElement.className = 'cart-item';
      itemElement.innerHTML = `
        <img src="assets/PRODUTOS/${item.id}.png" alt="${item.name}">
        <div class="item-info">
          <h3>${item.name}</h3>
          <p class="item-price">R$ ${price.toFixed(2).replace('.', ',')}</p>
          <div class="quantity-controls">
            <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
          </div>
          <button class="remove-btn" onclick="removeItem('${item.id}')">Remover</button>
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
  
    if (document.getElementById('subtotal')) {
      document.getElementById('subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
      document.getElementById('shipping').textContent = `R$ ${shipping.toFixed(2).replace('.', ',')}`;
      document.getElementById('total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
  }
  
  // Autenticação de Usuários
  async function signUp(email, password) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(userCredential.user.uid).set({
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        addresses: [],
        orders: []
      });
      return userCredential.user;
    } catch (error) {
      console.error("Erro no cadastro:", error);
      throw error;
    }
  }
  
  async function login(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    }
  }
  
  // Checkout e Pagamento
  async function handleCheckout() {
    if (!currentUser) {
      showAuthModal();
      return;
    }
  
    if (cart.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }
  
    try {
      // Criar sessão de pagamento no Stripe
      const response = await fetch('https://seu-backend.com/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart,
          userId: currentUser.uid
        })
      });
  
      const session = await response.json();
      
      const result = await stripe.redirectToCheckout({ sessionId: session.id });
      if (result.error) {
        alert(result.error.message);
      }
    } catch (error) {
      console.error('Erro no checkout:', error);
      alert('Erro ao processar o pagamento');
    }
  }
  
  // Sincronizar carrinho com Firestore
  async function syncCartWithFirestore() {
    if (!currentUser) return;
  
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const firestoreCart = userDoc.data()?.cart || [];
    
    const mergedCart = [...cart, ...firestoreCart].reduce((acc, item) => {
      const existing = acc.find(i => i.id === item.id);
      existing ? existing.quantity += item.quantity : acc.push(item);
      return acc;
    }, []);
  
    await db.collection('users').doc(currentUser.uid).update({ cart: mergedCart });
    localStorage.removeItem('cart');
    cart = mergedCart;
    updateCartCount();
    renderCartItems();
  }
  
  // Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    if (window.location.pathname.includes('cart.html')) {
      renderCartItems();
    }
  
    document.querySelectorAll('.btn-add').forEach(button => {
        button.addEventListener('click', (e) => {
          const priceElement = e.target.parentElement.querySelector('.price');
          const priceText = priceElement.textContent;
          
          // Converter preço de forma mais segura
          const price = parseFloat(
            priceText
              .replace(/[^0-9,]/g, '') // Remove símbolos não numéricos
              .replace(',', '.')
          ) || 0;
      
          const product = {
            id: e.target.dataset.product,
            name: e.target.parentElement.querySelector('h3').textContent,
            price: price
          };
          
          addToCart(product);
        });
      });
  
    auth.onAuthStateChanged(user => {
      currentUser = user;
      if (user) {
        syncCartWithFirestore();
      }
    });
  });
  
  // Modal de Autenticação
  function showAuthModal() {
    const email = prompt("Digite seu e-mail:");
    const password = prompt("Digite sua senha:");
    
    if (!email || !password) {
      alert('Preencha todos os campos!');
      return;
    }
  
    signUp(email, password)
      .then(() => handleCheckout())
      .catch(error => alert(`Erro: ${error.message}`));
  }
  
  // Inicialização (apenas para desenvolvimento)
  function initTestProducts() {
    const products = [
      { id: 'blusa_edukhan', name: 'Blusa Edukhan', price: 49.90 },
      { id: 'garrafa_edukhan', name: 'Garrafa Térmica', price: 39.90 },
      { id: 'caneca_edukhan', name: 'Caneca Premium', price: 29.90 },
      { id: 'caderno_edukhan', name: 'Caderno Ecológico', price: 24.90 },
      { id: 'ecobag_edukhan', name: 'Ecobag Sustentável', price: 34.90 },
      { id: 'bottom_edukhan', name: 'Kit de Bottons', price: 14.90 }
    ];
    
    // Garantir que os preços sejam números
    const validatedProducts = products.map(p => ({
      ...p,
      price: parseFloat(p.price)
    }));
    
    localStorage.setItem('testProducts', JSON.stringify(validatedProducts));
  }
  
  initTestProducts();