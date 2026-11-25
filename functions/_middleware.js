export function onRequest(context){
 const url=new URL(context.request.url);
 if(url.hostname==='mycoffeeshop.pages.dev'){url.hostname='mycoffeeshop.yv3.uk';return Response.redirect(url.toString(),301)}
 return context.next();
}
