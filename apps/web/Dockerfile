FROM node:20-alpine AS base                                                                                   
ENV PNPM_HOME="/pnpm"                                                                                         
ENV PATH="$PNPM_HOME:$PATH"                                                                                   
RUN corepack enable pnpm                                                                                      
                                                                                                              
FROM base AS builder                                                                                          
RUN apk update && apk add --no-cache libc6-compat                                                             
WORKDIR /app                                                                                                  
RUN pnpm install turbo --global                                                                               
COPY . .                                                                                                      
RUN turbo prune web --docker                                                                                  
                                                                                                              
FROM base AS installer                                                                                        
RUN apk update && apk add --no-cache libc6-compat                                                             
WORKDIR /app                                                                                                  
COPY .gitignore .gitignore                                                                                    
COPY --from=builder /app/out/json/ .                                                                          
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml                                                  
RUN pnpm install --frozen-lockfile                                                                            
COPY --from=builder /app/out/full/ .                                                                          
RUN pnpm turbo run build --filter=web...                                                                      
                                                                                                            
FROM base AS runner                                                                                           
WORKDIR /app                                                                                                  
ENV NODE_ENV=production                                                                                       
RUN addgroup --system --gid 1001 nodejs                                                                       
RUN adduser --system --uid 1001 nextjs                                                                        
USER nextjs                                                                                                   
                                                                                                              
COPY --from=installer /app/apps/web/next.config.ts .                                                          
COPY --from=installer /app/apps/web/package.json .  
                                                          
 # Automatically leverage output traces to reduce image size                                                   
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./                                 
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static                
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public                            
                                                                                                              
EXPOSE 3010                                                                                                   
ENV PORT=3010                                                                                                 
ENV HOSTNAME="0.0.0.0"                                                                                        
                                                                                                         
CMD ["node", "apps/web/server.js"]        
