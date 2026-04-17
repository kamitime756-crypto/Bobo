import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  Menu, 
  X, 
  ArrowRight, 
  Instagram, 
  Facebook, 
  Search,
  User,
  Heart,
  ChevronRight,
  ChevronLeft,
  Truck,
  ShieldCheck,
  RotateCcw,
  LogOut,
  Settings
} from 'lucide-react';
import { Product, CartItem } from './types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  writeBatch,
  doc
} from 'firebase/firestore';

const ProductGallery = ({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="relative h-full w-full group">
      <div className="h-full w-full overflow-hidden bg-stone-100">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>
      </div>
      
      {images.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-0 flex items-center p-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
              }}
              className="p-3 bg-white/50 backdrop-blur-md rounded-full hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center p-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
              }}
              className="p-3 bg-white/50 backdrop-blur-md rounded-full hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-bobo-ink scale-[3]' : 'bg-bobo-ink/30'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Hardcoded admin check for the prompt user
      setIsAdmin(u?.email === 'kamitime756@gmail.com');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Products Listener
  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = () => signOut(auth);

  const addToCart = (product: Product, size: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.selectedSize === size);
      if (existing) {
        return prev.map(item => 
          item.id === product.id && item.selectedSize === size 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, selectedSize: size }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string, size: string) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.selectedSize === size)));
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const checkout = async () => {
    if (!user) {
      login();
      return;
    }

    try {
      await addDoc(collection(db, 'orders'), {
        userUid: user.uid,
        userEmail: user.email,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedSize: item.selectedSize
        })),
        totalAmount: cartTotal,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      setCart([]);
      setIsCartOpen(false);
      alert("Order placed successfully! Thank you for shopping with BOBO.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const seedDatabase = async () => {
    if (!isAdmin) return;

    const initialProducts: Partial<Product>[] = [
      {
        name: 'Saharienne Linen Jacket',
        description: 'A tribute to Tunisian craftsmanship, made from premium locally sourced linen. Perfect for Mediterranean nights.',
        price: 320,
        category: 'Men',
        images: [
          'https://picsum.photos/seed/bobo-jacket-1/800/1100',
          'https://picsum.photos/seed/bobo-jacket-2/800/1100',
          'https://picsum.photos/seed/bobo-jacket-3/800/1100'
        ],
        isFeatured: true,
        sizes: ['S', 'M', 'L', 'XL']
      },
      {
        name: 'Sidi Bou Azure Dress',
        description: 'Hand-stitched cotton dress in the iconic blue and white of Sidi Bou Said. Features delicate lace detailing.',
        price: 450,
        category: 'Women',
        images: [
          'https://picsum.photos/seed/bobo-dress-1/800/1100',
          'https://picsum.photos/seed/bobo-dress-2/800/1100'
        ],
        isFeatured: true,
        sizes: ['XS', 'S', 'M']
      },
      {
        name: 'Carthage Silk Scarf',
        description: '100% pure silk scarf with geometric patterns inspired by ancient Carthaginian mosaics.',
        price: 180,
        category: 'Accessories',
        images: ['https://picsum.photos/seed/bobo-scarf/800/1100'],
        isFeatured: true,
        sizes: ['One Size']
      },
      {
        name: 'Berber Wool Gilet',
        description: 'Modern take on traditional Berber outerwear. Ethically sourced shepherd wool.',
        price: 260,
        category: 'Men',
        images: [
          'https://picsum.photos/seed/bobo-gilet-1/800/1100',
          'https://picsum.photos/seed/bobo-gilet-2/800/1100'
        ],
        isFeatured: false,
        sizes: ['M', 'L']
      },
      {
        name: 'Jasmine Embroidered Blouse',
        description: 'Light cotton blouse with jasmine flower embroidery, a symbol of Tunisian heritage.',
        price: 210,
        category: 'Women',
        images: ['https://picsum.photos/seed/bobo-blouse/800/1100'],
        isFeatured: false,
        sizes: ['S', 'M', 'L']
      },
      {
        name: 'Medina Canvas Tote',
        description: 'Durable canvas tote with leather handles. Each bag is hand-stamped in the souks of Tunis.',
        price: 120,
        category: 'Accessories',
        images: [
          'https://picsum.photos/seed/bobo-tote-1/800/1100',
          'https://picsum.photos/seed/bobo-tote-2/800/1100'
        ],
        isFeatured: false,
        sizes: ['One Size']
      }
    ];

    try {
      const batch = writeBatch(db);
      initialProducts.forEach(p => {
        const docRef = doc(collection(db, 'products'));
        batch.set(docRef, { ...p, createdAt: serverTimestamp() });
      });
      await batch.commit();
      alert("Database seeded with initial collection.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  return (
    <div className="min-h-screen bg-bobo-cream font-sans selection:bg-bobo-gold selection:text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-md py-4 border-b border-bobo-warm/30' : 'bg-transparent py-8'}`}>
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center">
          <div className="flex-1 flex items-center gap-6">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 hover:text-bobo-gold transition-colors">
              <Menu size={24} strokeWidth={1.5} />
            </button>
            <div className="hidden lg:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-medium">
              <a href="#" className="hover:text-bobo-gold transition-colors">Shop All</a>
              <a href="#" className="hover:text-bobo-gold transition-colors">New Arrivals</a>
              <a href="#" className="hover:text-bobo-gold transition-colors">The Atelier</a>
              {isAdmin && (
                <button onClick={seedDatabase} className="text-bobo-gold hover:underline flex items-center gap-2">
                  <Settings size={14} /> Seed Data
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 text-center">
            <h1 className="text-3xl md:text-4xl font-serif tracking-[0.1em] text-bobo-ink uppercase cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>BOBO</h1>
          </div>

          <div className="flex-1 flex items-center justify-end gap-2 md:gap-6">
            <button className="hidden md:block p-2 hover:text-bobo-gold transition-colors">
              <Search size={22} strokeWidth={1.5} />
            </button>
            {user ? (
               <div className="flex items-center gap-4">
                  <span className="hidden md:block text-[10px] uppercase tracking-widest font-bold text-stone-400">Welcome, {user.displayName?.split(' ')[0]}</span>
                  <button onClick={logout} className="p-2 hover:text-bobo-gold transition-colors">
                    <LogOut size={22} strokeWidth={1.5} />
                  </button>
               </div>
            ) : (
              <button onClick={login} className="p-2 hover:text-bobo-gold transition-colors">
                <User size={22} strokeWidth={1.5} />
              </button>
            )}
            <button 
              onClick={() => setIsCartOpen(true)} 
              className="p-2 hover:text-bobo-gold transition-colors relative"
            >
              <ShoppingBag size={22} strokeWidth={1.5} />
              {cart.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-bobo-gold text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative h-[90vh] md:h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://picsum.photos/seed/tunisia-fashion/1920/1080?blur=1" 
            alt="Hero" 
            className="w-full h-full object-cover scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/20 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bobo-cream/80" />
        </div>

        <div className="relative h-full flex flex-col justify-end pb-24 md:pb-32 px-6 md:px-12 max-w-[1800px] mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="max-w-3xl"
          >
            <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-white/90 font-semibold mb-4 block">
              Tunisian Heritage • Modern Spirit
            </span>
            <h2 className="text-5xl md:text-8xl lg:text-9xl font-serif text-white leading-[0.85] mb-8">
              Elegance <br /> Reimagined
            </h2>
            <div className="flex flex-wrap gap-4">
              <button className="px-8 md:px-12 py-4 bg-bobo-ink text-white uppercase text-[10px] md:text-xs tracking-[0.2em] font-semibold hover:bg-bobo-gold transition-all duration-300 transform hover:scale-105">
                Shop Women
              </button>
              <button className="px-8 md:px-12 py-4 border border-white text-white uppercase text-[10px] md:text-xs tracking-[0.2em] font-semibold backdrop-blur-sm hover:bg-white hover:text-bobo-ink transition-all duration-300 transform hover:scale-105">
                Shop Men
              </button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Featured Products */}
      <section className="py-24 md:py-32 px-6 md:px-12 max-w-[1800px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-xl">
            <span className="text-[10px] uppercase tracking-[0.3em] text-bobo-gold font-bold mb-4 block">Selection</span>
            <h3 className="text-4xl md:text-6xl font-serif leading-tight">Featured Pieces</h3>
          </div>
          <button className="group flex items-center gap-3 text-xs uppercase tracking-widest font-bold border-b border-bobo-ink pb-2 hover:text-bobo-gold hover:border-bobo-gold transition-all">
            View All Collection <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {products.filter(p => p.isFeatured).length === 0 && !loading && (
            <div className="col-span-full py-20 text-center border border-dashed border-bobo-warm rounded-2xl">
                <p className="text-stone-400 font-light mb-4 text-xl">Our collection is currently being refreshed.</p>
                {isAdmin && (
                  <button onClick={seedDatabase} className="px-8 py-3 bg-bobo-ink text-white text-[10px] uppercase tracking-widest font-bold">
                    Populate Collection
                  </button>
                )}
            </div>
          )}
          {products.filter(p => p.isFeatured).map((product, idx) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="group cursor-pointer"
              onClick={() => setSelectedProduct(product)}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-stone-100 mb-6">
                <img 
                  src={product.images[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => addToCart(product, product.sizes[0])}
                  className="absolute bottom-6 left-6 right-6 bg-white py-4 text-[10px] uppercase tracking-widest font-bold opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-bobo-ink hover:text-white"
                >
                  Quick Add
                </button>
                <button className="absolute top-6 right-6 p-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Heart size={18} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-serif mb-1 group-hover:text-bobo-gold transition-colors">{product.name}</h4>
                  <p className="text-[11px] text-stone-500 uppercase tracking-wider">{product.category}</p>
                </div>
                <p className="text-lg font-light">${product.price}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* The Atelier Section */}
      <section className="bg-bobo-ink py-24 md:py-40 text-white overflow-hidden">
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <img 
              src="https://picsum.photos/seed/craft/1000/1200" 
              alt="Craftsmanship" 
              className="w-full h-[600px] object-cover rounded-tl-[100px] rounded-br-[100px]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-10 -right-10 w-64 h-64 border border-bobo-gold/30 rounded-full hidden md:block" />
          </div>
          <div className="max-w-xl">
            <span className="text-[10px] uppercase tracking-[0.4em] text-bobo-gold font-bold mb-6 block">Our Story</span>
            <h3 className="text-5xl md:text-7xl font-serif leading-[1.1] mb-8">The Spirit of Tunisia</h3>
            <p className="text-stone-400 text-lg md:text-xl leading-relaxed font-light mb-12">
              Every BOBO piece is a reflection of Mediterranean soul. Born in the heart of Tunis, our atelier combines ancestral weaving techniques with contemporary silhouettes. We believe in slow fashion that respects both the artisan and the Earth.
            </p>
            <button className="group flex items-center gap-4 text-xs uppercase tracking-widest font-bold">
              Read Our Journal <div className="w-12 h-px bg-bobo-gold group-hover:w-20 transition-all duration-300" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 bg-white border-b border-bobo-warm/20">
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center text-center">
            <Truck size={32} className="text-bobo-gold mb-6" strokeWidth={1} />
            <h4 className="text-sm uppercase tracking-widest font-bold mb-3">Complimentary Delivery</h4>
            <p className="text-sm text-stone-500 font-light">Free shipping on all orders across Tunisia over 200 DT.</p>
          </div>
          <div className="flex flex-col items-center text-center border-y md:border-y-0 md:border-x border-bobo-warm/20 py-12 md:py-0">
            <ShieldCheck size={32} className="text-bobo-gold mb-6" strokeWidth={1} />
            <h4 className="text-sm uppercase tracking-widest font-bold mb-3">Authentic Quality</h4>
            <p className="text-sm text-stone-500 font-light">100% genuine local materials and ethical production.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <RotateCcw size={32} className="text-bobo-gold mb-6" strokeWidth={1} />
            <h4 className="text-sm uppercase tracking-widest font-bold mb-3">Seamless Exchanges</h4>
            <p className="text-sm text-stone-500 font-light">Changed your mind? Return or exchange within 14 days.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bobo-cream py-24 px-6 md:px-12 border-t border-bobo-warm/30">
        <div className="max-w-[1800px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 md:gap-8">
          <div className="col-span-1 lg:col-span-1">
            <h1 className="text-3xl font-serif tracking-[0.1em] text-bobo-ink uppercase mb-8">BOBO</h1>
            <p className="text-sm text-stone-500 font-light leading-relaxed mb-8">
              Redefining Tunisian style for the modern wanderer. Hand-crafted in Tunis.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-3 bg-white rounded-full hover:bg-bobo-ink hover:text-white transition-all shadow-sm">
                <Instagram size={18} />
              </a>
              <a href="#" className="p-3 bg-white rounded-full hover:bg-bobo-ink hover:text-white transition-all shadow-sm">
                <Facebook size={18} />
              </a>
            </div>
          </div>

          <div>
            <h5 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-8">Collections</h5>
            <ul className="space-y-4 text-sm font-light text-stone-600">
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Spring/Summer 24</a></li>
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Signature Linen</a></li>
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Accessories</a></li>
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Limited Edition</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-8">Assistance</h5>
            <ul className="space-y-4 text-sm font-light text-stone-600">
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Shipping & Returns</a></li>
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Size Guide</a></li>
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Care Instructions</a></li>
              <li><a href="#" className="hover:text-bobo-gold transition-colors">Contact Us</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-[10px] uppercase tracking-[0.3em] font-bold mb-8">Newsletter</h5>
            <p className="text-sm text-stone-500 font-light mb-6">Stay updated with our latest releases and atelier stories.</p>
            <div className="flex border-b border-bobo-ink pb-2">
              <input 
                type="email" 
                placeholder="EMAIL ADDRESS" 
                className="bg-transparent border-none outline-none text-[10px] tracking-widest w-full"
              />
              <button className="hover:text-bobo-gold transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-[1800px] mx-auto mt-24 pt-8 border-t border-bobo-warm/20 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest font-medium text-stone-400">
          <span>&copy; 2026 BOBO TUNISIA. All Rights Reserved.</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-bobo-ink transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-bobo-ink transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-bobo-ink/60 backdrop-blur-md z-[80]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-6 md:inset-12 lg:inset-20 bg-white z-[90] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 p-2 bg-white/80 backdrop-blur-md rounded-full z-10 hover:text-bobo-gold transition-colors"
              >
                <X size={24} />
              </button>

              <div className="w-full md:w-[55%] h-[50vh] md:h-full bg-stone-100">
                <ProductGallery images={selectedProduct.images} />
              </div>

              <div className="w-full md:w-[45%] p-8 md:p-14 lg:p-20 overflow-y-auto bg-white">
                <div className="flex flex-col h-full">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-bobo-gold font-bold mb-6 block">
                    {selectedProduct.category}
                  </span>
                  <h2 className="text-4xl lg:text-5xl font-serif mb-6 leading-tight text-bobo-ink">{selectedProduct.name}</h2>
                  <p className="text-2xl font-light mb-10 text-stone-600">${selectedProduct.price}</p>
                  
                  <p className="text-stone-500 text-base lg:text-lg font-light leading-relaxed mb-12">
                    {selectedProduct.description}
                  </p>

                  <div className="mb-12">
                    <p className="text-[10px] uppercase tracking-widest font-bold mb-4 text-bobo-ink">Select Size</p>
                    <div className="flex flex-wrap gap-3">
                      {selectedProduct.sizes.map(size => (
                        <button 
                          key={size}
                          className="px-8 py-4 border border-bobo-warm/30 rounded-full text-xs uppercase tracking-widest hover:border-bobo-ink hover:bg-bobo-ink hover:text-white transition-all cursor-pointer"
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 mt-auto">
                    <button 
                      onClick={() => {
                          addToCart(selectedProduct, selectedProduct.sizes[0]);
                          setSelectedProduct(null);
                      }}
                      className="flex-1 py-5 bg-bobo-ink text-white text-[10px] uppercase tracking-widest font-bold hover:bg-bobo-gold transition-all duration-300 rounded-xl"
                    >
                      Add to Bag
                    </button>
                    <button className="p-5 border border-bobo-warm/30 rounded-xl hover:border-bobo-gold hover:text-bobo-gold transition-all">
                      <Heart size={20} />
                    </button>
                  </div>
                  
                  <div className="mt-12 pt-12 border-t border-bobo-warm/20 grid grid-cols-2 gap-8">
                    <div className="flex items-start gap-4">
                      <Truck size={20} className="text-bobo-gold shrink-0" strokeWidth={1} />
                      <div>
                          <p className="text-[9px] uppercase tracking-widest font-bold mb-1">Free Delivery</p>
                          <p className="text-[11px] text-stone-500 font-light leading-snug">Orders over 200 DT in Tunisia</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <ShieldCheck size={20} className="text-bobo-gold shrink-0" strokeWidth={1} />
                      <div>
                          <p className="text-[9px] uppercase tracking-widest font-bold mb-1">Local Craft</p>
                          <p className="text-[11px] text-stone-500 font-light leading-snug">Handmade in our Tunis atelier</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-bobo-ink/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-full max-w-sm bg-white z-[70] p-12 flex flex-col"
            >
              <button onClick={() => setIsMenuOpen(false)} className="self-end mb-12 hover:text-bobo-gold transition-colors">
                <X size={28} strokeWidth={1} />
              </button>
              <div className="space-y-8">
                <a href="#" className="block text-4xl font-serif hover:italic hover:translate-x-4 transition-all duration-300">Women</a>
                <a href="#" className="block text-4xl font-serif hover:italic hover:translate-x-4 transition-all duration-300">Men</a>
                <a href="#" className="block text-4xl font-serif hover:italic hover:translate-x-4 transition-all duration-300">Accessories</a>
                <a href="#" className="block text-4xl font-serif hover:italic hover:translate-x-4 transition-all duration-300">The Atelier</a>
              </div>
              <div className="mt-auto space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Contact</p>
                <p className="text-sm font-light">Tunis, Tunisia</p>
                <p className="text-sm font-light">info@bobo-tunisia.com</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-bobo-ink/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-bobo-warm/20 flex justify-between items-center">
                <h4 className="text-lg font-serif">Your Bag ({cart.reduce((a, b) => a + b.quantity, 0)})</h4>
                <button onClick={() => setIsCartOpen(false)} className="hover:text-bobo-gold transition-colors">
                  <X size={24} strokeWidth={1} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <ShoppingBag size={48} strokeWidth={0.5} className="text-stone-300 mb-6" />
                    <p className="text-stone-500 font-light mb-8">Your bag is empty</p>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="px-8 py-3 bg-bobo-ink text-white text-[10px] uppercase tracking-widest font-bold"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={`${item.id}-${item.selectedSize}`} className="flex gap-6">
                      <div className="w-24 h-32 bg-stone-100 overflow-hidden flex-shrink-0">
                        <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 py-1">
                        <div className="flex justify-between mb-1">
                          <h5 className="text-[13px] font-medium uppercase tracking-wider">{item.name}</h5>
                          <button 
                            onClick={() => removeFromCart(item.id, item.selectedSize)}
                            className="text-stone-400 hover:text-bobo-ink"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] text-stone-500 mb-4 tracking-wide">Size: {item.selectedSize} | Qty: {item.quantity}</p>
                        <p className="text-sm font-medium">${item.price * item.quantity}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 bg-bobo-cream/50 border-t border-bobo-warm/20">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xs uppercase tracking-widest font-bold">Estimated Total</span>
                    <span className="text-2xl font-serif text-bobo-ink">${cartTotal}</span>
                  </div>
                  <button onClick={checkout} className="w-full py-5 bg-bobo-ink text-white text-[10px] uppercase tracking-widest font-bold hover:bg-bobo-gold transition-all duration-300 shadow-lg">
                    {user ? 'Proceed to Checkout' : 'Login to Checkout'}
                  </button>
                  <p className="text-[10px] text-stone-400 text-center mt-4 tracking-wider uppercase">Shipping & Taxes calculated at checkout</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
