using System.Text;
using Calc;
using Calc.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Cors.Internal;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Warlock.Services;
using Web.Services;
using WebApplication.Helpers;
using WebApplication.Services;

namespace WebApplication
{
    public class Startup
    {
        private IConfiguration Configuration { get; }
        private IHostingEnvironment Environment { get; }
        
        public Startup(IConfiguration configuration, IHostingEnvironment environment)
        {
            Configuration = configuration;
            Environment = environment;
        }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_1)
                .AddJsonOptions(
                    options => options
                        .SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore
                );

            // CORS
            services.AddCors(options => { options.AddPolicy("AllowMyOrigin", 
                policyBuilder => policyBuilder
                    .WithOrigins("*")
                    .WithMethods("*")
                    .WithHeaders("*")); });
            
            services.Configure<MvcOptions>(options =>
            {
                options.Filters.Add(new CorsAuthorizationFilterFactory("AllowMyOrigin"));
            });

            // In production, the React files will be served from this directory
            services.AddSpaStaticFiles(configuration => { configuration.RootPath = "ClientApp/build"; });
            
            // custom
            var appSettingsSection = Configuration.GetSection("AppSettings");
            services.Configure<AppSettings>(appSettingsSection);
            var appSettings = appSettingsSection.Get<AppSettings>();
            
            var key = Encoding.ASCII.GetBytes(appSettings.Secret);
            services.AddAuthentication(x =>
                {
                    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(x =>
                {
                    x.RequireHttpsMetadata = false;
                    x.SaveToken = true;
                    x.TokenValidationParameters = new TokenValidationParameters()
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(key),
                        ValidateIssuer = false,
                        ValidateAudience = false
                    };
                }).AddGoogle(googleOptions =>
                {
                    googleOptions.ClientId = appSettings.GoogleClientId;
                    googleOptions.ClientSecret = appSettings.GoogleClientSecret;
                });

            var connectionString = Environment.IsDevelopment() ? appSettings.DevelopmentConnectionString : appSettings.ProductionConnectionString;
            
            services.AddDbContext<DatabaseContext>(options => options.UseSqlServer(connectionString));
            services.AddScoped<FileHandlerService, FileHandlerService>();
            services
                .AddScoped<AgglomerativeHierarchicalClusteringService, AgglomerativeHierarchicalClusteringService>();
            services.AddScoped<OrderingService, OrderingService>();
            services.AddScoped<AuthService, AuthService>();
            services.AddScoped<UserItemService, UserItemService>();
            services.AddScoped<ItemService, ItemService>();
            services.AddScoped<PointsGroupService, PointsGroupService>();
            services.AddScoped<ItemFilterer, ItemFilterer>();
            services.AddScoped<FileConversionService, FileConversionService>();
            services.AddScoped<ClusteringService, ClusteringService>();
            services.AddScoped<ClusteringSummaryService, ClusteringSummaryService>();
            services.AddScoped<DistanceService, DistanceService>();
            services.AddScoped<DatabaseSettingProvider, DatabaseSettingProvider>();
            services.AddScoped<TourBridge, TourBridge>();
            services.AddScoped<TourProvider, TourProvider>();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseExceptionHandler("/Error");
                app.UseHsts();
            }

            app.UseHttpsRedirection();
            app.UseAuthentication();
            
            app.UseMvc(routes =>
            {
                routes.MapRoute(
                    name: "default",
                    template: "{controller}/{action=Index}/{id?}");
            });

            app.UseCors("AllowMyOrigin");
        }
    }
}