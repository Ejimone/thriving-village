from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("activity", "0002_alter_activitylog_kind"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="activitylog",
            index=models.Index(fields=["-occurred_at"], name="activity_log_occurred_at_idx"),
        ),
    ]
