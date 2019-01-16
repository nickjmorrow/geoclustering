using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication.Models.DTOs
{
    [Table("points", Schema="dbo")]
    public class Point
    {
        public int PointId { get; set; }
        public string Name { get; set; }
        public double HorizontalDisplacement { get; set; }
        public double VerticalDisplacement { get; set; }
        public int ItemId { get; set; }
    }
}