import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Folder, Home, Star, Tag, Trash2, Plus, BookmarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Category } from "@shared/schema";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    total: number;
    favorites: number;
    categories: number;
    tags: string[];
  };
}

export function Sidebar({ isOpen, onClose, stats }: SidebarProps) {
  const [location] = useLocation();
  
  const { data: categories = [] } = useQuery<(Category & { bookmarkCount: number })[]>({
    queryKey: ["/api/categories?withCounts=true"],
  });

  const isActive = (path: string) => location === path;

  const navItems = [
    { 
      path: "/", 
      icon: Home, 
      label: "All Bookmarks", 
      count: stats.total,
      active: isActive("/")
    },
    { 
      path: "/favorites", 
      icon: Star, 
      label: "Favorites", 
      count: stats.favorites,
      active: isActive("/favorites")
    },
    { 
      path: "/tags", 
      icon: Tag, 
      label: "Tags", 
      active: isActive("/tags")
    },
    { 
      path: "/trash", 
      icon: Trash2, 
      label: "Trash", 
      count: 0,
      active: isActive("/trash")
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 fixed lg:relative z-30 h-full
      `}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookmarkIcon className="text-primary-foreground" size={16} />
            </div>
            <h1 className="text-xl font-bold text-foreground">Memorize</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <Button
                variant={item.active ? "default" : "ghost"}
                className={`w-full justify-start space-x-3 ${
                  item.active 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={onClose}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon size={20} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count !== undefined && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.active 
                      ? "bg-primary-foreground text-primary" 
                      : "bg-secondary text-secondary-foreground"
                  }`}>
                    {item.count}
                  </span>
                )}
              </Button>
            </Link>
          ))}

          <Separator className="my-4" />

          {/* Folders Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Folders
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                data-testid="button-create-folder"
              >
                <Plus size={12} />
              </Button>
            </div>

            <div className="space-y-1">
              {categories.map((category) => (
                <Link key={category.id} href={`/category/${category.id}`}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start space-x-3 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={onClose}
                    data-testid={`folder-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Folder size={16} />
                    <span className="flex-1 text-left">{category.name}</span>
                    <span className="text-xs">{category.bookmarkCount}</span>
                  </Button>
                </Link>
              ))}

              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-2">
                  No folders yet
                </p>
              )}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
