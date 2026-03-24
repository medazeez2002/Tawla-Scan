import { RouterProvider } from 'react-router';
import { router } from './routes';
import { CartProvider } from './context/CartContext';
import { OrdersProvider } from './context/OrdersContext';
import { MenuProvider } from './context/MenuContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <ThemeProvider>
      <MenuProvider>
        <OrdersProvider>
          <CartProvider>
            <RouterProvider router={router} />
            <Toaster position="top-center" />
          </CartProvider>
        </OrdersProvider>
      </MenuProvider>
    </ThemeProvider>
  );
}