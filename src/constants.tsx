
import { Product, CategoryItem, SubCategoryItem, Complement } from './types.ts';

export const DEFAULT_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/* 
   🚀 CONFIGURAÇÃO WHITE LABEL 🚀
   Deixe as listas vazias para que o sistema inicie "zerado".
   O lojista poderá cadastrar tudo pelo Painel Admin.
*/

export const DEMO_CATEGORIES: CategoryItem[] = [];

export const DEMO_SUB_CATEGORIES: SubCategoryItem[] = [];

export const DEMO_PRODUCTS: Product[] = [];

export const DEMO_COMPLEMENTS: Complement[] = [];

export const DEMO_SETTINGS = [
  { id: 'general', isStoreOpen: true, logoUrl: DEFAULT_LOGO }
];

export const PRODUCTS: Product[] = [];
export const CATEGORIES = ['Todos'];
