using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using NUnit.Framework;
using Warlock.Services;
using WebApplication;
using WebApplication.Controllers;
using WebApplication.Models;
using WebApplication.Models.DTOs;
using ItemType = WebApplication.Enums.ItemType;

namespace Web.Services
{
    [Authorize]
    public class PointsGroupService
    {
        private DatabaseContext _context;
        private ItemService _itemService;
        private ItemFilterer _itemFilterer;

        public PointsGroupService(DatabaseContext context, 
            ItemService itemService, 
            ItemFilterer itemFilterer)
        {
            this._context = context;
            this._itemService = itemService;
            this._itemFilterer = itemFilterer;
        }

        // TODO: should think in terms of 'points groups', and users can be permissioned to whole groups
        // it does'nt make sense to keep track of permissioning on a points-level
        
        // TODO: create has-many relationship between pointsGroup and points
        // be able to upload file and save it as a pointsGroup
        
        // TODO: let me upload a file to replace a pointsGroup
        
        // TODO: let me rename a pointsGroup

        public IEnumerable<PointsGroup> GetPointsGroups(int userId)
        {
            using (var context = this._context)
            {
                var pointsGroups = context.PointsGroups
                    .Include(pg => pg.Points);
                return this._itemFilterer.GetValidItems(userId, pointsGroups);
            }
        }

        public async Task<int> AddPointsGroupAsync(int userId, PointsGroupInput pointsGroupInput)
        {
            // create itemId for pointsGroup
            var itemId = await this._itemService.AddItemAsync((int) ItemType.PointsGroup);
            
            var pointsGroup = new PointsGroup()
            {
                Name = pointsGroupInput.Name,
                ItemId = itemId
            };
            
            // add pointsGroup
            using (var context = this._context)
            {
                await context.PointsGroups.AddAsync(pointsGroup);
                await context.UserItems.AddAsync(new UserItem() {UserId = userId, ItemId = itemId});
                await context.SaveChangesAsync();
            }

            // label points with pointsGroupId
            var points = pointsGroupInput.Points.Select(p =>
            {
                p.PointsGroupId = pointsGroup.PointsGroupId;
                return p;
            });

            // add associated points 
            using (var context = this._context)
            {
                await context.Points.AddRangeAsync(points);
                await context.SaveChangesAsync();
            }
            return pointsGroup.PointsGroupId;
        }
    }
}