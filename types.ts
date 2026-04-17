/**
 * Product and Cart types for the Bobo clothing store.
 */

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    category: 'Men' | 'Women' | 'Accessories';
    images: string[];
    isFeatured?: boolean;
    sizes: string[];
}

export interface CartItem extends Product {
    quantity: number;
    selectedSize: string;
}
