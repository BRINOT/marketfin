import { authMiddleware } from '@clerk/nextjs';
import { NextResponse } from 'next/server';

export default authMiddleware({
  // Public routes that don't require authentication
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/webhooks(.*)',
    '/api/cron(.*)',
    '/pricing',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
  ],

  // Routes that can be accessed while signed out but will show different content when signed in
  ignoredRoutes: [
    '/api/health',
  ],

  afterAuth(auth, req) {
    // Handle users who aren't authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Redirect signed-in users from public pages to dashboard
    if (auth.userId && req.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Check for onboarding completion
    if (auth.userId && !auth.sessionClaims?.metadata?.onboardingComplete) {
      const onboardingUrl = new URL('/onboarding', req.url);
      if (req.nextUrl.pathname !== '/onboarding') {
        return NextResponse.redirect(onboardingUrl);
      }
    }

    return NextResponse.next();
  },
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
