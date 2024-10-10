import Head from 'next/head'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no" />
        <meta name="theme-color" content="#ffffff" />
        <title>El Rey Sales Dashboard</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp