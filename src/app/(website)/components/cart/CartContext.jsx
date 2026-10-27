"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/next_panel/components/UserContext";
import CartLoginModal from "./CartLoginModal";

const CartContext = createContext(null);

const STORAGE_KEY = "cst_store_cart_v1";

export function CartProvider({ children }) {
    const { user, isLoggedIn } = useUser();
    const [items, setItems] = useState([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [hasHydrated, setHasHydrated] = useState(false);

    // Modal state for guest login prompt
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [attemptedProduct, setAttemptedProduct] = useState(null);

    // 1. Initial Load from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                }
            }
        } catch {
            // ignore
        } finally {
            setHasHydrated(true);
        }
    }, []);

    // 2. Persist to localStorage on change
    useEffect(() => {
        if (!hasHydrated) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
            // ignore
        }
    }, [items, hasHydrated]);

    // 3. Optional sync with backend cart for logged-in public user
    useEffect(() => {
        if (!isLoggedIn || !user || !hasHydrated) return;

        let cancelled = false;

        async function syncBackendCart() {
            try {
                const ownerParam = user.is_public
                    ? `public_user_id=${user.id}`
                    : `customer_user_id=${user.id}`;

                // Check or create backend cart
                const res = await fetch(`/api/cart?${ownerParam}`);
                const json = await res.json();

                if (json.success && json.data && json.data.length > 0) {
                    const cartId = json.data[0].id;
                    const itemsRes = await fetch(`/api/cart-items?cart_id=${cartId}`);
                    const itemsJson = await itemsRes.json();

                    if (!cancelled && itemsJson.success && itemsJson.data?.length > 0) {
                        // Merge backend cart items with local
                        setItems((localItems) => {
                            const map = new Map(localItems.map((i) => [i.product_id, i]));
                            itemsJson.data.forEach((bi) => {
                                if (!map.has(bi.product_id)) {
                                    map.set(bi.product_id, {
                                        product_id: bi.product_id,
                                        product_name: bi.product_name,
                                        slug: bi.product_slug || `product-${bi.product_id}`,
                                        price: Number(bi.price || 0),
                                        sale_price: bi.sale_price !== null ? Number(bi.sale_price) : null,
                                        tax_percent: Number(bi.tax_percent || 0),
                                        image: bi.image_path || null,
                                        quantity: Number(bi.quantity || 1),
                                    });
                                }
                            });
                            return Array.from(map.values());
                        });
                    }
                }
            } catch {
                // Background sync error is non-fatal
            }
        }

        syncBackendCart();

        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, user?.id, hasHydrated]);

    // Add to cart (requires login)
    const addToCart = (product, quantity = 1) => {
        if (!product || !product.id) return false;

        // Block if user is not logged in
        if (!isLoggedIn || !user) {
            setAttemptedProduct(product);
            setLoginModalOpen(true);
            return false;
        }

        const effectivePrice = Number(product.sale_price ?? product.price ?? 0);
        const effectiveTax = Number(product.tax_percent ?? 0);

        setItems((prev) => {
            const existingIndex = prev.findIndex((i) => i.product_id === product.id);
            if (existingIndex > -1) {
                const next = [...prev];
                next[existingIndex] = {
                    ...next[existingIndex],
                    quantity: next[existingIndex].quantity + quantity,
                };
                return next;
            } else {
                return [
                    ...prev,
                    {
                        product_id: product.id,
                        product_name: product.product_name || product.name || "Product",
                        slug: product.slug || `product-${product.id}`,
                        product_code: product.product_code || null,
                        price: Number(product.price ?? effectivePrice),
                        sale_price: product.sale_price !== null && product.sale_price !== undefined ? Number(product.sale_price) : null,
                        tax_percent: effectiveTax,
                        image: product.image || product.primary_image || product.category_image || null,
                        quantity,
                    },
                ];
            }
        });

        // Open cart drawer for instant feedback
        setDrawerOpen(true);
        return true;
    };

    // Update quantity
    const updateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }

        setItems((prev) =>
            prev.map((item) =>
                item.product_id === productId ? { ...item, quantity } : item
            )
        );
    };

    // Remove item
    const removeFromCart = (productId) => {
        setItems((prev) => prev.filter((item) => item.product_id !== productId));
    };

    // Clear cart
    const clearCart = () => {
        setItems([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
    };

    // Computations
    const itemCount = useMemo(
        () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        [items]
    );

    const subtotal = useMemo(
        () =>
            items.reduce((sum, item) => {
                const unit = Number(item.sale_price ?? item.price ?? 0);
                return sum + unit * (Number(item.quantity) || 1);
            }, 0),
        [items]
    );

    const taxTotal = useMemo(
        () =>
            items.reduce((sum, item) => {
                const unit = Number(item.sale_price ?? item.price ?? 0);
                const taxRate = Number(item.tax_percent ?? 0) / 100;
                return sum + unit * taxRate * (Number(item.quantity) || 1);
            }, 0),
        [items]
    );

    const grandTotal = useMemo(() => subtotal + taxTotal, [subtotal, taxTotal]);

    return (
        <CartContext.Provider
            value={{
                items,
                itemCount,
                subtotal,
                taxTotal,
                grandTotal,
                drawerOpen,
                setDrawerOpen,
                addToCart,
                updateQuantity,
                removeFromCart,
                clearCart,
                loginModalOpen,
                setLoginModalOpen,
                openLoginModal: (prod) => {
                    if (prod) setAttemptedProduct(prod);
                    setLoginModalOpen(true);
                },
            }}
        >
            {children}
            <CartLoginModal
                isOpen={loginModalOpen}
                onClose={() => setLoginModalOpen(false)}
                product={attemptedProduct}
            />
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        return {
            items: [],
            itemCount: 0,
            subtotal: 0,
            taxTotal: 0,
            grandTotal: 0,
            drawerOpen: false,
            setDrawerOpen: () => {},
            addToCart: () => {},
            updateQuantity: () => {},
            removeFromCart: () => {},
            clearCart: () => {},
        };
    }
    return context;
}
