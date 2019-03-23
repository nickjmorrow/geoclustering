using System;
using System.Collections.Generic;
using Calc.Models;
using Web.Models;
using WebApplication.Enums;

namespace WebApplication.Models.DTOs
{
    public class PointsGroupDTO
    {
        public int PointsGroupId { get; set; }
        public string Name { get; set; }
        public double AverageHorizontalDisplacement { get; set; }
        public double AverageVerticalDisplacement { get; set; }
        public IEnumerable<Point> Points { get; set; }
        public ItemPermissionType ItemPermissionType { get; set; }
        public AhcInfo AhcInfo { get; set; }
        public ClusteringSummary ClusteringSummary { get; set; }
    }
}