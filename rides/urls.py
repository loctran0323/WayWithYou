from django.urls import path

from . import views

app_name = "rides"
urlpatterns = [
    path("", views.index, name="index"),
    path("add/", views.add_ride, name="add"),
    path("hearted/", views.hearted_list, name="hearted"),
    path("heart/", views.heart_toggle, name="heart_toggle"),
]
